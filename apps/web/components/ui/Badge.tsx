import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "accent" | "good" | "warning" | "critical";

const TONES: Record<BadgeTone, { color: string; background: string; border: string }> = {
  neutral: {
    color: "var(--ink-2)",
    background: "transparent",
    border: "var(--border)",
  },
  accent: {
    color: "var(--accent)",
    background: "var(--accent-soft)",
    border: "color-mix(in srgb, var(--accent) 30%, transparent)",
  },
  good: {
    color: "var(--good)",
    background: "color-mix(in srgb, var(--good) 12%, transparent)",
    border: "color-mix(in srgb, var(--good) 30%, transparent)",
  },
  warning: {
    color: "var(--warning)",
    background: "color-mix(in srgb, var(--warning) 14%, transparent)",
    border: "color-mix(in srgb, var(--warning) 32%, transparent)",
  },
  critical: {
    color: "var(--critical)",
    background: "color-mix(in srgb, var(--critical) 12%, transparent)",
    border: "color-mix(in srgb, var(--critical) 32%, transparent)",
  },
};

/** Colour is never the only carrier of meaning here — every badge has a label. */
export function Badge({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  const t = TONES[tone];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${className}`}
      style={{ color: t.color, background: t.background, borderColor: t.border }}
    >
      {children}
    </span>
  );
}
