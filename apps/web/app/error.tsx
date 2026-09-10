"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="rounded-xl border border-hairline bg-surface p-10 text-center shadow-card">
      <h1 className="text-xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-1 text-sm text-ink-2">
        The page failed to render. Retrying is usually enough; if it persists, check the server
        logs.
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-xs text-muted">digest {error.digest}</p>
      )}
      <div className="mt-5 flex justify-center">
        <Button variant="primary" onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  );
}
