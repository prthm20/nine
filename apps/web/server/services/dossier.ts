import { prisma } from "../db";
import { collectSignals, signalKey } from "./osint/collectors";
import { computeRiskScore } from "./riskScoring";

// Minimal stand-in for the existing 10-day dossier generation core: gather
// OSINT signals, persist them, snapshot the signal set for later monitoring
// diffs, then compute a risk score on top.
export async function runDossierPipeline(companyId: string) {
  const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
  const collected = await collectSignals(company);

  await prisma.$transaction([
    prisma.signal.deleteMany({ where: { companyId } }),
    prisma.signal.createMany({
      data: collected.map((s) => ({ companyId, ...s })),
    }),
  ]);

  await saveSnapshot(companyId);
  const riskScore = await computeRiskScore(companyId);
  return { signalCount: collected.length, riskScore };
}

export async function saveSnapshot(companyId: string) {
  const signals = await prisma.signal.findMany({ where: { companyId } });
  const summary = signals
    .map((s) => ({
      key: signalKey(s),
      category: s.category,
      type: s.type,
      title: s.title,
      severity: s.severity,
    }))
    .sort((a, b) => a.key.localeCompare(b.key));

  const { createHash } = await import("node:crypto");
  const fingerprint = createHash("sha256").update(JSON.stringify(summary)).digest("hex");

  return prisma.signalSnapshot.create({
    data: { companyId, fingerprint, payload: JSON.stringify(summary) },
  });
}
