"use client";

import { useState } from "react";
import { Card } from "./ui/Card";
import { Badge } from "./ui/Badge";
import { SourceLink } from "./ui/SourceLink";
import { ChevronIcon } from "./ui/Icons";
import { RISK_CATEGORIES, riskBand, type RiskCategoryKey } from "@/lib/risk";
import { formatDateTime, toISO } from "@/lib/format";

type Factor = {
  id: string;
  category: string;
  label: string;
  weight: number;
  evidenceText: string;
  sourceUrl: string;
  sentiment: number;
};

type Score = {
  overallScore: number;
  financialScore: number;
  legalScore: number;
  reputationalScore: number;
  cyberScore: number;
  explanations: Record<string, string>;
  computedAt: Date;
  modelVersion: string;
  factors: Factor[];
};

function categoryScore(score: Score, key: RiskCategoryKey): number {
  switch (key) {
    case "financial":
      return score.financialScore;
    case "legal":
      return score.legalScore;
    case "reputational":
      return score.reputationalScore;
    case "cyber":
      return score.cyberScore;
  }
}

export function RiskScoreBreakdown({ score }: { score: Score }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const overall = riskBand(score.overallScore);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div>
          <div className="text-xs font-medium tracking-wide text-muted uppercase">
            Overall risk score
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              className="text-5xl leading-none font-semibold tabular-nums"
              style={{ color: overall.color }}
            >
              {score.overallScore}
            </span>
            <span className="text-lg text-muted">/ 100</span>
            <Badge tone={overall.tone} className="ml-1">
              {overall.label} risk
            </Badge>
          </div>
        </div>
        <div className="text-xs text-muted sm:text-right">
          <div>
            Computed{" "}
            <time dateTime={toISO(score.computedAt)}>{formatDateTime(score.computedAt)}</time>
          </div>
          <div className="mt-0.5 font-mono">{score.modelVersion}</div>
        </div>
      </div>

      <p className="mt-4 text-sm text-ink-2">
        Each category is scored from the evidence gathered below. Expand a category to see the
        plain-English rationale and every signal that moved it, with its source.
      </p>

      <ul className="mt-5 divide-y divide-hairline border-y border-hairline">
        {RISK_CATEGORIES.map(({ key, label }) => {
          const value = categoryScore(score, key);
          const band = riskBand(value);
          const factors = score.factors.filter((f) => f.category === key);
          const isOpen = expanded === key;
          const panelId = `risk-panel-${key}`;

          return (
            <li key={key}>
              <button
                onClick={() => setExpanded(isOpen ? null : key)}
                className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-surface-2 sm:gap-4"
                aria-expanded={isOpen}
                aria-controls={panelId}
              >
                <ChevronIcon
                  className={`h-4 w-4 shrink-0 text-muted transition-transform ${isOpen ? "rotate-90" : ""}`}
                />
                <span className="w-24 shrink-0 text-sm font-medium sm:w-28">{label}</span>
                <span
                  role="meter"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={value}
                  aria-label={`${label} risk score`}
                  className="relative hidden h-2 flex-1 overflow-hidden rounded-full sm:block"
                  style={{ background: band.soft }}
                >
                  <span
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{ width: `${value}%`, background: band.color }}
                  />
                </span>
                <span className="ml-auto flex shrink-0 items-center gap-3 sm:ml-0">
                  <Badge tone={band.tone}>{band.label}</Badge>
                  <span className="w-8 text-right text-sm font-semibold tabular-nums">{value}</span>
                  <span className="hidden w-20 text-right text-xs text-muted sm:inline">
                    {factors.length} factor{factors.length === 1 ? "" : "s"}
                  </span>
                </span>
              </button>

              {isOpen && (
                <div id={panelId} className="pb-4 sm:pl-11">
                  <p className="rounded-md bg-surface-2 px-3 py-2.5 text-sm text-ink-2">
                    {score.explanations[key] ?? "No explanation was recorded for this category."}
                  </p>

                  {factors.length > 0 ? (
                    <ul className="mt-3 space-y-3">
                      {factors.map((f) => (
                        <li key={f.id} className="border-l-2 border-hairline pl-3">
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                            <span className="text-sm font-medium">{f.label}</span>
                            <span className="text-xs text-muted tabular-nums">
                              {Math.round(f.weight * 100)}% of category impact
                            </span>
                          </div>
                          <p className="mt-0.5 text-sm text-ink-2">{f.evidenceText}</p>
                          <div className="mt-1 text-xs">
                            <SourceLink url={f.sourceUrl} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-muted">
                      No individual signals contributed to this category.
                    </p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <p className="mt-4 text-xs leading-relaxed text-muted">
        Scoring method: each signal contributes severity × negativity; category scores use a
        saturating curve into 0–100, and the overall score is the weighted average across
        categories. Weights are configurable via <code className="font-mono">RISK_WEIGHTS_JSON</code>
        .
      </p>
    </Card>
  );
}
