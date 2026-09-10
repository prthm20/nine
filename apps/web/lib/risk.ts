// Single source of truth for how a 0-100 risk score is banded and coloured.
// The dashboard, the dossier header and the category meters all read from here
// so a score never changes meaning between two views of the same company.

export type RiskTone = "good" | "warning" | "critical";

export type RiskBand = {
  label: string;
  tone: RiskTone;
  /** CSS colour for meters, dots and chips. */
  color: string;
  /** Same hue as a wash, for chip and track backgrounds. */
  soft: string;
};

export function riskBand(score: number): RiskBand {
  if (score >= 70) {
    return {
      label: "High",
      tone: "critical",
      color: "var(--critical)",
      soft: "color-mix(in srgb, var(--critical) 14%, transparent)",
    };
  }
  if (score >= 40) {
    return {
      label: "Elevated",
      tone: "warning",
      color: "var(--warning)",
      soft: "color-mix(in srgb, var(--warning) 16%, transparent)",
    };
  }
  return {
    label: "Low",
    tone: "good",
    color: "var(--good)",
    soft: "color-mix(in srgb, var(--good) 14%, transparent)",
  };
}

export const RISK_CATEGORIES = [
  { key: "financial", label: "Financial" },
  { key: "legal", label: "Legal" },
  { key: "reputational", label: "Reputational" },
  { key: "cyber", label: "Cyber" },
] as const;

export type RiskCategoryKey = (typeof RISK_CATEGORIES)[number]["key"];

export const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  RISK_CATEGORIES.map((c) => [c.key, c.label])
);

/** Signal severity is 0-1; analysts read words faster than decimals. */
export function severityLabel(severity: number): { label: string; color: string } {
  if (severity >= 0.7) return { label: "Critical", color: "var(--critical)" };
  if (severity >= 0.4) return { label: "Material", color: "var(--warning)" };
  return { label: "Low", color: "var(--muted)" };
}
