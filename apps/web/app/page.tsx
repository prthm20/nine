"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, ErrorNotice, Skeleton } from "@/components/ui/Feedback";
import { ChevronIcon, PlusIcon, PulseIcon, SearchIcon, ShieldIcon } from "@/components/ui/Icons";
import { riskBand } from "@/lib/risk";
import { formatDate, toISO } from "@/lib/format";

type SortKey = "score" | "name" | "signals";

const SORT_LABELS: Record<SortKey, string> = {
  score: "Highest risk",
  name: "Company name",
  signals: "Most signals",
};

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-hairline bg-surface px-4 py-3 shadow-card">
      <div className="text-xs font-medium tracking-wide text-muted uppercase">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-xs text-ink-2">{hint}</div>}
    </div>
  );
}

export default function DashboardPage() {
  const utils = trpc.useUtils();
  const companies = trpc.company.list.useQuery();

  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("score");

  const create = trpc.company.create.useMutation({
    onSuccess: () => {
      setName("");
      setDomain("");
      utils.company.list.invalidate();
    },
  });

  const rows = companies.data ?? [];

  const stats = useMemo(() => {
    const scored = rows.filter((c) => c.latestScore);
    const avg = scored.length
      ? Math.round(scored.reduce((sum, c) => sum + c.latestScore!.overallScore, 0) / scored.length)
      : null;
    return {
      total: rows.length,
      monitored: rows.filter((c) => c.isMonitored).length,
      highRisk: scored.filter((c) => c.latestScore!.overallScore >= 70).length,
      unscored: rows.length - scored.length,
      avg,
    };
  }, [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? rows.filter(
          (c) => c.name.toLowerCase().includes(q) || (c.domain ?? "").toLowerCase().includes(q)
        )
      : rows;
    return [...filtered].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "signals") return b.signalCount - a.signalCount;
      // Unscored companies sort last - they carry no assessment yet.
      return (b.latestScore?.overallScore ?? -1) - (a.latestScore?.overallScore ?? -1);
    });
  }, [rows, query, sort]);

  const nameIsValid = name.trim().length >= 2;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Risk portfolio</h1>
        <p className="mt-1 text-sm text-ink-2">
          Generate OSINT dossiers, score them against four risk categories, and monitor the
          companies that matter for changes.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Companies"
          value={String(stats.total)}
          hint={stats.unscored > 0 ? `${stats.unscored} without a dossier` : "all scored"}
        />
        <Stat label="Monitored" value={String(stats.monitored)} hint="active subscriptions" />
        <Stat label="High risk" value={String(stats.highRisk)} hint="score 70 or above" />
        <Stat
          label="Average score"
          value={stats.avg === null ? "—" : String(stats.avg)}
          hint="across scored companies"
        />
      </div>

      <Card>
        <CardHeader
          title="Add a company"
          description="Distinctive legal names match best. A domain enables the DNS and certificate checks."
          icon={<PlusIcon />}
        />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (nameIsValid) {
              create.mutate({ name: name.trim(), domain: domain.trim() || undefined });
            }
          }}
          className="mt-4 flex flex-wrap items-end gap-3"
        >
          <div className="min-w-56 flex-1">
            <label htmlFor="company-name" className="mb-1 block text-xs font-medium text-ink-2">
              Company name
            </label>
            <input
              id="company-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Infosys Limited"
              autoComplete="organization"
              className="h-9 w-full rounded-md border border-line bg-surface px-3 text-sm placeholder:text-muted"
            />
          </div>
          <div className="w-full sm:w-56">
            <label htmlFor="company-domain" className="mb-1 block text-xs font-medium text-ink-2">
              Domain <span className="text-muted">(optional)</span>
            </label>
            <input
              id="company-domain"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="infosys.com"
              autoComplete="url"
              className="h-9 w-full rounded-md border border-line bg-surface px-3 text-sm placeholder:text-muted"
            />
          </div>
          <Button type="submit" variant="primary" loading={create.isPending} disabled={!nameIsValid}>
            Add company
          </Button>
        </form>
        {create.error && (
          <div className="mt-3">
            <ErrorNotice>{create.error.message}</ErrorNotice>
          </div>
        )}
      </Card>

      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-3 border-b border-hairline px-4 py-3 sm:px-5">
          <div className="relative min-w-48 flex-1">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by name or domain"
              aria-label="Filter companies"
              className="h-9 w-full rounded-md border border-line bg-surface pl-9 pr-3 text-sm placeholder:text-muted"
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="sort" className="text-xs font-medium text-ink-2">
              Sort
            </label>
            <select
              id="sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="h-9 rounded-md border border-line bg-surface px-2 text-sm"
            >
              {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                <option key={k} value={k}>
                  {SORT_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {companies.isLoading && (
          <ul className="divide-y divide-hairline">
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex items-center gap-4 px-4 py-4 sm:px-5">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
                <Skeleton className="h-8 w-16" />
              </li>
            ))}
          </ul>
        )}

        {companies.error && (
          <div className="p-4 sm:p-5">
            <ErrorNotice>{companies.error.message}</ErrorNotice>
          </div>
        )}

        {!companies.isLoading && !companies.error && visible.length === 0 && (
          <EmptyState
            icon={<ShieldIcon className="h-6 w-6" />}
            title={rows.length === 0 ? "No companies yet" : "No companies match that filter"}
            description={
              rows.length === 0
                ? "Add a company above to gather its first set of OSINT signals."
                : "Try a different name or domain."
            }
          />
        )}

        <ul className="divide-y divide-hairline">
          {visible.map((c) => {
            const score = c.latestScore;
            const band = score ? riskBand(score.overallScore) : null;
            return (
              <li key={c.id}>
                <Link
                  href={`/companies/${c.id}`}
                  className="group flex items-center gap-4 px-4 py-4 transition-colors hover:bg-surface-2 sm:px-5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium">{c.name}</span>
                      {c.isMonitored && (
                        <Badge tone="accent">
                          <PulseIcon className="h-3 w-3" />
                          Monitored
                        </Badge>
                      )}
                      {!score && <Badge>No dossier</Badge>}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted">
                      {c.domain ?? "no domain"} · {c.signalCount} signal
                      {c.signalCount === 1 ? "" : "s"}
                      {score && (
                        <>
                          {" · scored "}
                          <time dateTime={toISO(score.computedAt)}>
                            {formatDate(score.computedAt)}
                          </time>
                        </>
                      )}
                    </div>
                  </div>

                  {score && band ? (
                    <div className="flex items-center gap-3">
                      <Badge tone={band.tone} className="hidden sm:inline-flex">
                        {band.label} risk
                      </Badge>
                      <div className="text-right">
                        <div
                          className="text-2xl leading-none font-semibold tabular-nums"
                          style={{ color: band.color }}
                        >
                          {score.overallScore}
                        </div>
                        <div className="mt-0.5 text-[11px] text-muted">/ 100</div>
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-muted">Not assessed</span>
                  )}

                  <ChevronIcon className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
