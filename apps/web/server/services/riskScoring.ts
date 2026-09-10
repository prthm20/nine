import type { Signal } from "@prisma/client";
import { prisma } from "../db";
import { chatCompletion } from "./aiClient";
import {
  getRiskWeights,
  RISK_CATEGORIES,
  RISK_MODEL_VERSION,
  type RiskCategory,
} from "../config/riskWeights";

// ─────────────────────────────────────────────────────────────────────────────
// Feature 1: Risk Scoring with Explainability
//
// Each category sub-score is derived from the signals the dossier pipeline
// already gathered: every signal contributes impact = severity × negativity,
// and impacts are aggregated through a saturating curve so a pile of minor
// signals can't outrank one critical one, and scores stay in 0–100.
// The AI pass (AICredits) turns each sub-score into a plain-English
// explanation that must cite the underlying evidence by source URL; if the AI
// call is unavailable, a deterministic template explanation is used instead.
// ─────────────────────────────────────────────────────────────────────────────

type FactorInput = {
  category: RiskCategory;
  label: string;
  weight: number; // share of the category's total impact, 0..1
  evidenceText: string;
  sourceUrl: string;
  sentiment: number;
};

export type Explanations = Record<RiskCategory, string>;

function signalImpact(s: Pick<Signal, "severity" | "sentiment">): number {
  // negativity maps sentiment [-1, 1] → [1, 0]; positive signals reduce impact
  const negativity = (1 - s.sentiment) / 2;
  return s.severity * negativity;
}

function categoryScore(signals: Signal[]): number {
  // Saturating curve: 0 impact → 0, ~1.5 impact → ~41, ~3 impact → ~65.
  // Calibrated for live adverse-media collectors, which only surface negative
  // coverage: any well-covered company fills its 6-article quota, so a steeper
  // curve would pin every household name at 80+ and destroy discrimination.
  const totalImpact = signals.reduce((sum, s) => sum + signalImpact(s), 0);
  return Math.round(100 * (1 - Math.exp(-0.35 * totalImpact)));
}

function buildFactors(category: RiskCategory, signals: Signal[]): FactorInput[] {
  const total = signals.reduce((sum, s) => sum + signalImpact(s), 0) || 1;
  return signals
    .map((s) => ({
      category,
      label: s.title,
      weight: Number((signalImpact(s) / total).toFixed(3)),
      evidenceText: s.detail,
      sourceUrl: s.sourceUrl,
      sentiment: s.sentiment,
    }))
    .sort((a, b) => b.weight - a.weight);
}

function fallbackExplanation(category: RiskCategory, score: number, factors: FactorInput[]): string {
  if (factors.length === 0) {
    return `No ${category} risk signals were found in the gathered OSINT data, so the ${category} score is minimal.`;
  }
  const top = factors.slice(0, 3);
  const drivers = top
    .map((f) => `"${f.label}" (${Math.round(f.weight * 100)}% of category impact; source: ${f.sourceUrl})`)
    .join("; ");
  return (
    `The ${category} score of ${score}/100 is driven primarily by: ${drivers}. ` +
    `Scores reflect signal severity weighted by sentiment across ${factors.length} gathered signal(s).`
  );
}

async function generateExplanations(
  scores: Record<RiskCategory, number>,
  factorsByCategory: Record<RiskCategory, FactorInput[]>
): Promise<Explanations> {
  const evidenceBlock = RISK_CATEGORIES.map((cat) => {
    const lines = factorsByCategory[cat]
      .map((f) => `- [${f.sourceUrl}] ${f.label}: ${f.evidenceText} (weight ${f.weight}, sentiment ${f.sentiment.toFixed(2)})`)
      .join("\n");
    return `## ${cat} (score ${scores[cat]}/100)\n${lines || "- no signals"}`;
  }).join("\n\n");

  const raw = await chatCompletion([
    {
      role: "system",
      content:
        "You are a risk analyst writing explanations for a company risk dossier. " +
        "For each category, explain in 2-3 plain-English sentences why the score is what it is. " +
        "Every claim MUST cite the specific evidence that drove it by including its source URL in parentheses. " +
        "Do not invent evidence beyond what is listed. " +
        'Respond with ONLY a JSON object: {"financial": "...", "legal": "...", "reputational": "...", "cyber": "..."}',
    },
    { role: "user", content: evidenceBlock },
  ]);

  if (raw) {
    try {
      const jsonText = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      const parsed = JSON.parse(jsonText) as Partial<Explanations>;
      const complete = RISK_CATEGORIES.every((c) => typeof parsed[c] === "string");
      if (complete) return parsed as Explanations;
    } catch {
      // fall through to deterministic explanations
    }
  }

  return Object.fromEntries(
    RISK_CATEGORIES.map((c) => [c, fallbackExplanation(c, scores[c], factorsByCategory[c])])
  ) as Explanations;
}

export async function computeRiskScore(companyId: string) {
  const signals = await prisma.signal.findMany({ where: { companyId } });
  const weights = getRiskWeights();

  const scores = {} as Record<RiskCategory, number>;
  const factorsByCategory = {} as Record<RiskCategory, FactorInput[]>;
  for (const cat of RISK_CATEGORIES) {
    const catSignals = signals.filter((s) => s.category === cat);
    scores[cat] = categoryScore(catSignals);
    factorsByCategory[cat] = buildFactors(cat, catSignals);
  }

  const overall = Math.round(RISK_CATEGORIES.reduce((sum, c) => sum + scores[c] * weights[c], 0));
  const explanations = await generateExplanations(scores, factorsByCategory);

  return prisma.riskScore.create({
    data: {
      companyId,
      overallScore: overall,
      financialScore: scores.financial,
      legalScore: scores.legal,
      reputationalScore: scores.reputational,
      cyberScore: scores.cyber,
      explanations: JSON.stringify(explanations),
      modelVersion: RISK_MODEL_VERSION,
      factors: {
        create: RISK_CATEGORIES.flatMap((c) => factorsByCategory[c]),
      },
    },
    include: { factors: true },
  });
}

export async function getLatestRiskScore(companyId: string) {
  return prisma.riskScore.findFirst({
    where: { companyId },
    orderBy: { computedAt: "desc" },
    include: { factors: true },
  });
}
