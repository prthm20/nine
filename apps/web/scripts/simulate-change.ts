// Dev helper: makes the most recent snapshot/score look "stale" so the next
// monitoring recheck detects new signals and a score change. Useful for
// demoing alerts without waiting for real-world coverage to change.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const companyId = process.argv[2];
  if (!companyId) throw new Error("Usage: tsx scripts/simulate-change.ts <companyId>");

  const snapshot = await prisma.signalSnapshot.findFirst({
    where: { companyId },
    orderBy: { takenAt: "desc" },
  });
  if (!snapshot) throw new Error("No snapshot found — generate the dossier first.");

  const entries = JSON.parse(snapshot.payload) as { key: string }[];
  const trimmed = entries.slice(0, Math.max(0, entries.length - 2));
  await prisma.signalSnapshot.update({
    where: { id: snapshot.id },
    data: { payload: JSON.stringify(trimmed) },
  });

  const score = await prisma.riskScore.findFirst({
    where: { companyId },
    orderBy: { computedAt: "desc" },
  });
  const loweredScore = score ? Math.max(0, score.overallScore - 10) : null;
  if (score && loweredScore !== null) {
    await prisma.riskScore.update({
      where: { id: score.id },
      data: { overallScore: loweredScore },
    });
  }

  // Alerts are diffed against each subscriber's own watermark, so rewind those
  // too — otherwise the trimmed snapshot and lowered score look already-seen.
  const { count } = await prisma.monitoredCompany.updateMany({
    where: { companyId, isActive: true },
    data: {
      lastSnapshotId: snapshot.id,
      ...(loweredScore !== null ? { lastNotifiedScore: loweredScore } : {}),
    },
  });

  console.log(
    `Trimmed snapshot to ${trimmed.length}/${entries.length} entries, lowered last score by 10, ` +
      `and rewound ${count} subscriber watermark(s).`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
