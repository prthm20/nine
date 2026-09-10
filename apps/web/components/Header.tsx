"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { AlertsBell } from "./AlertsBell";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { ShieldIcon, SparkIcon } from "./ui/Icons";

export function Header() {
  const utils = trpc.useUtils();
  const plan = trpc.billing.getPlan.useQuery();
  const me = trpc.auth.me.useQuery();
  const upgrade = trpc.billing.upgradeToProDemo.useMutation({
    onSuccess: () => utils.invalidate(),
  });

  const isPro = plan.data?.plan === "PRO";

  return (
    <header
      className="sticky top-0 z-20 border-b border-hairline"
      style={{ background: "color-mix(in srgb, var(--surface) 88%, transparent)", backdropFilter: "blur(8px)" }}
    >
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 rounded-md" aria-label="Company Risk Dossier — home">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-white">
            <ShieldIcon className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight sm:text-base">
            Company Risk Dossier
          </span>
        </Link>

        {plan.isLoading ? (
          <Badge>&nbsp;·&nbsp;</Badge>
        ) : (
          <Badge tone={isPro ? "accent" : "neutral"}>
            {isPro && <SparkIcon className="h-3 w-3" />}
            {isPro ? "Pro" : "Free"}
          </Badge>
        )}

        <div className="ml-auto flex items-center gap-2">
          {plan.data && !isPro && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => upgrade.mutate()}
              loading={upgrade.isPending}
            >
              Upgrade to Pro
            </Button>
          )}
          <AlertsBell />

          {/* Only shown once real auth is configured; demo mode has no session. */}
          {me.data?.authEnabled && me.data.user && (
            <form action="/auth/signout" method="post" className="flex items-center gap-2">
              <span
                className="hidden max-w-[14ch] truncate text-xs text-ink-2 sm:inline"
                title={me.data.user.email}
              >
                {me.data.user.email}
              </span>
              <Button type="submit" variant="ghost" size="sm">
                Sign out
              </Button>
            </form>
          )}
        </div>
      </div>
    </header>
  );
}
