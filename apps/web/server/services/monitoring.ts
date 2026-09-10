import type { MonitoredCompany } from "@prisma/client";
import { prisma } from "../db";
import { collectSignals } from "./osint/collectors";
import { computeRiskScore, getLatestRiskScore } from "./riskScoring";
import { saveSnapshot } from "./dossier";
import { sendAlertEmail } from "./notifier";

// ─────────────────────────────────────────────────────────────────────────────
// Feature 2: Continuous Monitoring
//
// Two concerns, deliberately kept apart:
//
//   Collection is per COMPANY. Signals, snapshots and risk scores hang off
//   Company and are shared, so a refresh runs exactly once no matter how many
//   people subscribe — one set of OSINT fetches, one snapshot, one score.
//
//   Notification is per SUBSCRIBER. Alerts hang off MonitoredCompany, so each
//   subscriber diffs the new snapshot against the snapshot *they* were last
//   notified up to (their watermark), not against the company's newest one.
//   Otherwise whichever subscriber's recheck ran first would consume the
//   change and everyone else would silently get nothing.
//
// A scheduled dispatcher (Inngest cron) finds companies with at least one due
// subscriber and fans out one refresh per company; each refresh then fans the
// diff out to every subscriber of that company that is due.
// ─────────────────────────────────────────────────────────────────────────────

const FREQUENCY_MS: Record<string, number> = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};

type SnapshotEntry = { key: string; category: string; type: string; title: string; severity: number };

function isDue(monitor: Pick<MonitoredCompany, "frequency" | "lastCheckedAt">, now: Date): boolean {
  const interval = FREQUENCY_MS[monitor.frequency] ?? FREQUENCY_MS.daily;
  return !monitor.lastCheckedAt || now.getTime() - monitor.lastCheckedAt.getTime() >= interval;
}

/** Companies with at least one active subscriber due for a check. */
export async function findDueCompanyIds(now = new Date()): Promise<string[]> {
  const monitors = await prisma.monitoredCompany.findMany({ where: { isActive: true } });
  return [...new Set(monitors.filter((m) => isDue(m, now)).map((m) => m.companyId))];
}

function alertSeverity(maxSignalSeverity: number): string {
  if (maxSignalSeverity >= 0.65) return "high";
  if (maxSignalSeverity >= 0.4) return "medium";
  return "low";
}

/**
 * Per-company half: re-fetch the sources, replace the shared signal set,
 * snapshot it and recompute the shared risk score. Runs once per refresh.
 */
async function refreshCompany(companyId: string) {
  const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
  const previousScore = await getLatestRiskScore(companyId);

  const collected = await collectSignals(company);
  await prisma.$transaction([
    prisma.signal.deleteMany({ where: { companyId } }),
    prisma.signal.createMany({
      data: collected.map((s) => ({ companyId, ...s })),
    }),
  ]);

  const snapshot = await saveSnapshot(companyId);
  const score = await computeRiskScore(companyId);
  return { company, snapshot, score, previousScore };
}

type Refresh = Awaited<ReturnType<typeof refreshCompany>>;

/**
 * Per-subscriber half: diff the refreshed snapshot against this subscriber's
 * own watermark, record what is new *to them*, then advance the watermark.
 */
async function notifyMonitor(monitor: MonitoredCompany, refresh: Refresh, now: Date) {
  const newEntries = JSON.parse(refresh.snapshot.payload) as SnapshotEntry[];

  // Watermark, or — for subscriptions predating watermarks — the company's
  // previous snapshot, which is the baseline the old global diff used.
  const baseline = monitor.lastSnapshotId
    ? await prisma.signalSnapshot.findUnique({ where: { id: monitor.lastSnapshotId } })
    : await prisma.signalSnapshot.findFirst({
        where: { companyId: monitor.companyId, id: { not: refresh.snapshot.id } },
        orderBy: { takenAt: "desc" },
      });
  const baselineKeys = new Set(
    baseline ? (JSON.parse(baseline.payload) as SnapshotEntry[]).map((e) => e.key) : []
  );

  const pending: { changeType: string; severity: string; summary: string }[] = [];

  const newSignals = newEntries.filter((e) => !baselineKeys.has(e.key));
  if (baseline && newSignals.length > 0) {
    const top = [...newSignals].sort((a, b) => b.severity - a.severity)[0];
    pending.push({
      changeType: "new_signal",
      severity: alertSeverity(top.severity),
      summary:
        newSignals.length === 1
          ? `New ${top.category} signal: ${top.title}`
          : `${newSignals.length} new signals detected, most severe (${top.category}): ${top.title}`,
    });
  }

  const baselineScore = monitor.lastNotifiedScore ?? refresh.previousScore?.overallScore ?? null;
  if (baselineScore !== null && Math.abs(refresh.score.overallScore - baselineScore) >= 5) {
    const direction = refresh.score.overallScore > baselineScore ? "increased" : "decreased";
    pending.push({
      changeType: "score_change",
      severity: refresh.score.overallScore > baselineScore ? "high" : "low",
      summary: `Overall risk score ${direction} from ${baselineScore} to ${refresh.score.overallScore}`,
    });
  }

  const created = pending.length
    ? await prisma.$transaction(
        pending.map((a) =>
          prisma.monitoringAlert.create({ data: { monitoredCompanyId: monitor.id, ...a } })
        )
      )
    : [];

  await prisma.monitoredCompany.update({
    where: { id: monitor.id },
    data: {
      lastCheckedAt: now,
      lastSnapshotId: refresh.snapshot.id,
      lastNotifiedScore: refresh.score.overallScore,
    },
  });

  if (created.length > 0) {
    const user = await prisma.user.findUnique({ where: { id: monitor.userId } });
    if (user) await sendAlertEmail(user, refresh.company, created);
  }

  return { newSignalCount: newSignals.length, alertsCreated: created.map((a) => a.id) };
}

/** Manual "check now": refresh the company, then notify this one subscriber. */
export async function recheckMonitoredCompany(monitoredCompanyId: string) {
  const monitor = await prisma.monitoredCompany.findUniqueOrThrow({
    where: { id: monitoredCompanyId },
  });
  const refresh = await refreshCompany(monitor.companyId);
  const result = await notifyMonitor(monitor, refresh, new Date());
  return { companyId: monitor.companyId, ...result };
}

/** Scheduled path: one refresh per company, fanned out to every due subscriber. */
export async function recheckCompanyForDueSubscribers(companyId: string, now = new Date()) {
  const due = (
    await prisma.monitoredCompany.findMany({ where: { companyId, isActive: true } })
  ).filter((m) => isDue(m, now));

  if (due.length === 0) return { companyId, notified: 0, alertsCreated: [] as string[] };

  const refresh = await refreshCompany(companyId);
  const results = [];
  for (const monitor of due) {
    results.push(await notifyMonitor(monitor, refresh, now));
  }

  return {
    companyId,
    notified: due.length,
    alertsCreated: results.flatMap((r) => r.alertsCreated),
  };
}
