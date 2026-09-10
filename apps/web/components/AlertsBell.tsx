"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Badge, type BadgeTone } from "./ui/Badge";
import { BellIcon } from "./ui/Icons";
import { formatDateShort, formatDateTime, toISO } from "@/lib/format";

const SEVERITY_TONE: Record<string, BadgeTone> = {
  high: "critical",
  medium: "warning",
  low: "neutral",
};

const CHANGE_LABELS: Record<string, string> = {
  new_signal: "New signal",
  score_change: "Score move",
  resolved: "Resolved",
};

export function AlertsBell() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const utils = trpc.useUtils();
  const alerts = trpc.monitoring.getAlerts.useQuery(undefined, { refetchInterval: 30_000 });
  const markAllRead = trpc.monitoring.markAllRead.useMutation({
    onSuccess: () => utils.monitoring.getAlerts.invalidate(),
  });

  const items = alerts.data ?? [];
  const unread = items.filter((a) => !a.isRead).length;

  // A popover that only closes via its own trigger feels broken; close on
  // Escape (returning focus to the trigger) and on any click outside it.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        aria-label={
          unread > 0 ? `Monitoring alerts, ${unread} unread` : "Monitoring alerts, none unread"
        }
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relative flex h-8 w-8 items-center justify-center rounded-md border border-line text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <BellIcon className="h-4 w-4" />
        {unread > 0 && (
          <span
            aria-hidden
            className="absolute -right-1.5 -top-1.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white tabular-nums"
            style={{ background: "var(--critical)", height: "1.125rem", minWidth: "1.125rem" }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Monitoring alerts"
          className="absolute right-0 mt-2 w-[24rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-hairline bg-surface shadow-pop"
        >
          <div className="flex items-center justify-between gap-2 border-b border-hairline px-4 py-2.5">
            <span className="text-sm font-semibold">Monitoring alerts</span>
            {unread > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="rounded text-xs font-medium text-accent hover:underline disabled:opacity-60"
              >
                Mark all read
              </button>
            )}
          </div>

          <ul className="max-h-[22rem] overflow-y-auto">
            {alerts.isLoading && (
              <li className="px-4 py-8 text-center text-sm text-muted">Loading alerts…</li>
            )}
            {!alerts.isLoading && items.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-muted">
                No alerts yet. Companies you monitor report changes here.
              </li>
            )}
            {items.map((a) => (
              <li key={a.id} className="border-b border-hairline last:border-b-0">
                <Link
                  href={`/companies/${a.companyId}`}
                  onClick={() => setOpen(false)}
                  className="block px-4 py-3 transition-colors hover:bg-surface-2"
                  style={a.isRead ? undefined : { boxShadow: "inset 2px 0 0 var(--accent)" }}
                >
                  <div className="flex items-center gap-2">
                    <Badge tone={SEVERITY_TONE[a.severity] ?? "neutral"}>
                      {CHANGE_LABELS[a.changeType] ?? a.changeType}
                    </Badge>
                    <span className="truncate text-xs font-medium text-ink-2">{a.companyName}</span>
                    <time
                      dateTime={toISO(a.detectedAt)}
                      title={formatDateTime(a.detectedAt)}
                      className="ml-auto shrink-0 text-xs text-muted tabular-nums"
                    >
                      {formatDateShort(a.detectedAt)}
                    </time>
                  </div>
                  <p className={`mt-1.5 text-sm ${a.isRead ? "text-ink-2" : "font-medium text-ink"}`}>
                    {a.summary}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
