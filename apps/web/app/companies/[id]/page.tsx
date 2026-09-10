"use client";

import { use, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { RiskScoreBreakdown } from "@/components/RiskScoreBreakdown";
import { MonitoringPanel } from "@/components/MonitoringPanel";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, ErrorNotice, Skeleton } from "@/components/ui/Feedback";
import { SourceLink } from "@/components/ui/SourceLink";
import { ArrowLeftIcon, ExternalLinkIcon, RefreshIcon, ShieldIcon, SparkIcon } from "@/components/ui/Icons";
import { CATEGORY_LABELS, RISK_CATEGORIES, severityLabel } from "@/lib/risk";
import { formatDate, toISO } from "@/lib/format";

export default function CompanyDossierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const utils = trpc.useUtils();
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});

  const company = trpc.company.getById.useQuery({ id });
  const riskScore = trpc.riskScore.getByCompany.useQuery({ companyId: id });

  const invalidate = () =>
    Promise.all([
      utils.company.getById.invalidate({ id }),
      utils.company.list.invalidate(),
      utils.riskScore.getByCompany.invalidate({ companyId: id }),
    ]);

  const generate = trpc.dossier.generate.useMutation({ onSuccess: invalidate });
  const recompute = trpc.riskScore.recompute.useMutation({ onSuccess: invalidate });

  if (company.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (company.error || !company.data) {
    return (
      <Card>
        <EmptyState
          icon={<ShieldIcon className="h-6 w-6" />}
          title="Company not found"
          description="This dossier does not exist, or it was removed."
          action={
            <Link
              href="/"
              className="inline-flex h-9 items-center gap-2 rounded-md bg-accent px-3.5 text-sm font-medium text-white hover:bg-accent-hover"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Back to portfolio
            </Link>
          }
        />
      </Card>
    );
  }

  const c = company.data;
  const hasSignals = c.signals.length > 0;

  // Group by category, then present in the fixed scoring order so the evidence
  // section reads in the same sequence as the score breakdown above it.
  const byCategory = new Map<string, typeof c.signals>();
  for (const s of c.signals) {
    const list = byCategory.get(s.category) ?? [];
    list.push(s);
    byCategory.set(s.category, list);
  }
  const orderedCategories = [
    ...RISK_CATEGORIES.map((r) => r.key as string).filter((k) => byCategory.has(k)),
    ...[...byCategory.keys()].filter((k) => !RISK_CATEGORIES.some((r) => r.key === k)),
  ];

  const mutationError = generate.error?.message ?? recompute.error?.message;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded text-sm text-ink-2 hover:text-ink"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Portfolio
        </Link>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">{c.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
              {c.domain ? (
                <a
                  href={`https://${c.domain}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 rounded hover:text-ink"
                >
                  {c.domain}
                  <ExternalLinkIcon className="h-3 w-3" />
                </a>
              ) : (
                <span>No domain set — DNS and certificate checks are skipped</span>
              )}
              {c.country && <span>· {c.country}</span>}
              <span>
                · {c.signals.length} signal{c.signals.length === 1 ? "" : "s"} on file
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              onClick={() => generate.mutate({ companyId: id })}
              loading={generate.isPending}
            >
              {!generate.isPending && <SparkIcon className="h-3.5 w-3.5" />}
              {generate.isPending
                ? "Gathering OSINT…"
                : hasSignals
                  ? "Regenerate dossier"
                  : "Generate dossier"}
            </Button>
            {hasSignals && (
              <Button
                onClick={() => recompute.mutate({ companyId: id })}
                loading={recompute.isPending}
              >
                {!recompute.isPending && <RefreshIcon className="h-3.5 w-3.5" />}
                Recompute score
              </Button>
            )}
          </div>
        </div>

        {generate.isPending && (
          <p className="mt-3 text-sm text-ink-2">
            Querying news, court records, regulatory filings and infrastructure sources. This
            usually takes a few seconds.
          </p>
        )}
        {mutationError && (
          <div className="mt-3">
            <ErrorNotice>{mutationError}</ErrorNotice>
          </div>
        )}
      </div>

      {riskScore.isLoading ? (
        <Skeleton className="h-56 w-full" />
      ) : riskScore.data ? (
        <RiskScoreBreakdown score={riskScore.data} />
      ) : (
        <Card padded={false}>
          <EmptyState
            icon={<ShieldIcon className="h-6 w-6" />}
            title="No risk score yet"
            description="Generate the dossier to gather OSINT signals and compute an explainable score across the financial, legal, reputational and cyber categories."
            action={
              <Button
                variant="primary"
                onClick={() => generate.mutate({ companyId: id })}
                loading={generate.isPending}
              >
                Generate dossier
              </Button>
            }
          />
        </Card>
      )}

      <MonitoringPanel companyId={id} monitor={c.monitor} />

      {hasSignals && (
        <Card>
          <CardHeader
            title="Evidence"
            description="Every signal the score is built from, grouped by category and ordered by severity."
          />

          <div className="mt-4 space-y-3">
            {orderedCategories.map((category) => {
              const signals = byCategory.get(category)!;
              const isOpen = openCategories[category] ?? true;
              return (
                <div key={category} className="rounded-lg border border-hairline">
                  <button
                    onClick={() =>
                      setOpenCategories((prev) => ({ ...prev, [category]: !isOpen }))
                    }
                    aria-expanded={isOpen}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-surface-2"
                  >
                    <span className="text-sm font-semibold">
                      {CATEGORY_LABELS[category] ?? category}
                    </span>
                    <Badge>{signals.length}</Badge>
                    <span className="ml-auto text-xs text-muted">{isOpen ? "Hide" : "Show"}</span>
                  </button>

                  {isOpen && (
                    <ul className="divide-y divide-hairline border-t border-hairline">
                      {signals.map((s) => {
                        const sev = severityLabel(s.severity);
                        return (
                          <li key={s.id} className="px-3 py-3">
                            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                              <span className="text-sm font-medium">{s.title}</span>
                              <span className="flex shrink-0 items-center gap-2">
                                <span
                                  className="text-xs font-medium"
                                  style={{ color: sev.color }}
                                >
                                  {sev.label}
                                </span>
                                <time
                                  dateTime={toISO(s.observedAt)}
                                  className="text-xs text-muted tabular-nums"
                                >
                                  {formatDate(s.observedAt)}
                                </time>
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-ink-2">{s.detail}</p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                              <SourceLink url={s.sourceUrl} className="max-w-full" />
                              <span className="text-muted tabular-nums">
                                severity {s.severity.toFixed(2)} · sentiment{" "}
                                {s.sentiment.toFixed(2)} · {s.type.replace(/_/g, " ")}
                              </span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
