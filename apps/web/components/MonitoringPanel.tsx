"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardHeader } from "./ui/Card";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { ErrorNotice, StatusNotice } from "./ui/Feedback";
import { PulseIcon, RefreshIcon, SparkIcon } from "./ui/Icons";
import { formatDateTime, toISO } from "@/lib/format";

type Monitor = {
  id: string;
  frequency: string;
  isActive: boolean;
  lastCheckedAt: Date | null;
} | null;

export function MonitoringPanel({
  companyId,
  monitor,
}: {
  companyId: string;
  monitor: Monitor;
}) {
  const utils = trpc.useUtils();
  const plan = trpc.billing.getPlan.useQuery();
  const [frequency, setFrequency] = useState(monitor?.frequency ?? "daily");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const announce = (message: string) => {
    setStatus(message);
    setError(null);
  };
  const fail = (message: string) => {
    setError(message);
    setStatus(null);
  };

  const invalidate = () =>
    Promise.all([
      utils.company.getById.invalidate({ id: companyId }),
      utils.riskScore.getByCompany.invalidate({ companyId }),
      utils.monitoring.getAlerts.invalidate(),
    ]);

  const subscribe = trpc.monitoring.subscribe.useMutation({
    onSuccess: () => {
      announce("Monitoring enabled. The next scheduled recheck runs at 06:00 UTC.");
      invalidate();
    },
    onError: (e) => fail(e.message),
  });

  const unsubscribe = trpc.monitoring.unsubscribe.useMutation({
    onSuccess: () => {
      announce("Monitoring paused. No further alerts will be raised for this company.");
      invalidate();
    },
    onError: (e) => fail(e.message),
  });

  const recheck = trpc.monitoring.recheckNow.useMutation({
    onSuccess: (r) => {
      announce(
        r.newSignalCount > 0
          ? `Check complete — ${r.newSignalCount} new signal${r.newSignalCount === 1 ? "" : "s"}, ${r.alertsCreated.length} alert${r.alertsCreated.length === 1 ? "" : "s"} raised.`
          : "Check complete — no meaningful changes since the last snapshot."
      );
      invalidate();
    },
    onError: (e) => fail(e.message),
  });

  const isActive = monitor?.isActive ?? false;
  const isPro = plan.data?.plan === "PRO";

  return (
    <Card>
      <CardHeader
        icon={<PulseIcon />}
        title="Continuous monitoring"
        description={
          isActive
            ? "Sources are re-queried on a schedule; new signals and material score moves raise an alert."
            : "Get alerted when this company's risk picture changes."
        }
        actions={
          isActive ? (
            <Badge tone="good">Active</Badge>
          ) : isPro ? (
            <Badge>Paused</Badge>
          ) : (
            <Badge tone="accent">
              <SparkIcon className="h-3 w-3" />
              Pro feature
            </Badge>
          )
        }
      />

      {isActive && (
        <dl className="mt-4 grid grid-cols-2 gap-3 border-y border-hairline py-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted">Frequency</dt>
            <dd className="mt-0.5 font-medium capitalize">{monitor?.frequency}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Last checked</dt>
            <dd className="mt-0.5 font-medium">
              {monitor?.lastCheckedAt ? (
                <time dateTime={toISO(monitor.lastCheckedAt)}>
                  {formatDateTime(monitor.lastCheckedAt)}
                </time>
              ) : (
                "Never"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Alert threshold</dt>
            <dd className="mt-0.5 font-medium">New signal or ±5 points</dd>
          </div>
        </dl>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!isActive ? (
          <>
            <label htmlFor="frequency" className="sr-only">
              Recheck frequency
            </label>
            <select
              id="frequency"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              disabled={!isPro}
              className="h-9 rounded-md border border-line bg-surface px-2 text-sm disabled:opacity-55"
            >
              <option value="daily">Daily rechecks</option>
              <option value="weekly">Weekly rechecks</option>
            </select>
            <Button
              variant="primary"
              onClick={() =>
                subscribe.mutate({ companyId, frequency: frequency as "daily" | "weekly" })
              }
              loading={subscribe.isPending}
              disabled={!isPro}
              title={isPro ? undefined : "Upgrade to Pro to enable monitoring"}
            >
              Enable monitoring
            </Button>
            {!isPro && (
              <span className="text-xs text-muted">
                The free tier includes one-time dossiers only — upgrade from the header.
              </span>
            )}
          </>
        ) : (
          <>
            <Button variant="primary" onClick={() => recheck.mutate({ companyId })} loading={recheck.isPending}>
              <RefreshIcon className="h-3.5 w-3.5" />
              Check now
            </Button>
            <Button onClick={() => unsubscribe.mutate({ companyId })} loading={unsubscribe.isPending}>
              Pause monitoring
            </Button>
          </>
        )}
      </div>

      <div aria-live="polite" className="empty:hidden">
        {error && (
          <div className="mt-3">
            <ErrorNotice>{error}</ErrorNotice>
          </div>
        )}
        {status && !error && (
          <div className="mt-3">
            <StatusNotice>{status}</StatusNotice>
          </div>
        )}
      </div>
    </Card>
  );
}
