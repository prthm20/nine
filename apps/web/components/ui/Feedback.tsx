import type { ReactNode } from "react";
import { AlertIcon } from "./Icons";

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`animate-pulse rounded-md ${className}`}
      style={{ background: "color-mix(in srgb, var(--ink) 8%, transparent)" }}
    />
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      {icon && <span className="text-muted">{icon}</span>}
      <p className="font-medium">{title}</p>
      {description && <p className="max-w-md text-sm text-ink-2">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Mutation failures are announced, not just coloured red. */
export function ErrorNotice({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-md border px-3 py-2 text-sm"
      style={{
        borderColor: "color-mix(in srgb, var(--critical) 35%, transparent)",
        background: "color-mix(in srgb, var(--critical) 8%, transparent)",
        color: "var(--critical)",
      }}
    >
      <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="text-ink">{children}</span>
    </div>
  );
}

export function StatusNotice({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-md border border-hairline bg-surface-2 px-3 py-2 text-sm text-ink-2">
      {children}
    </p>
  );
}
