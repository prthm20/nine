export const RISK_CATEGORIES = ["financial", "legal", "reputational", "cyber"] as const;
export type RiskCategory = (typeof RISK_CATEGORIES)[number];

export type RiskWeights = Record<RiskCategory, number>;

const DEFAULT_WEIGHTS: RiskWeights = {
  financial: 0.3,
  legal: 0.3,
  reputational: 0.2,
  cyber: 0.2,
};

// Weights are configurable (not hardcoded at call sites) so they can be tuned
// without code changes: set RISK_WEIGHTS_JSON to a partial or full override.
// Values are re-normalized so they always sum to 1.
export function getRiskWeights(): RiskWeights {
  let weights = { ...DEFAULT_WEIGHTS };
  const raw = process.env.RISK_WEIGHTS_JSON;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<Record<RiskCategory, number>>;
      for (const cat of RISK_CATEGORIES) {
        const v = parsed[cat];
        if (typeof v === "number" && v >= 0) weights[cat] = v;
      }
    } catch {
      // Malformed override — fall back to defaults rather than failing scoring.
    }
  }
  const total = RISK_CATEGORIES.reduce((s, c) => s + weights[c], 0) || 1;
  for (const cat of RISK_CATEGORIES) weights[cat] = weights[cat] / total;
  return weights;
}

export const RISK_MODEL_VERSION = "risk-v1";
