"use client";

import { useState, type FormEvent } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ErrorNotice } from "@/components/ui/Feedback";
import { ShieldIcon } from "@/components/ui/Icons";

// Magic-link sign-in: no password to store or reset, and Supabase verifies the
// address for us — which matters because alert emails are addressed to it.
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const params = new URLSearchParams(window.location.search);
    const next = params.get("next") ?? "/";
    const supabase = createSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    setPending(false);
    if (signInError) setError(signInError.message);
    else setSent(true);
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
      <Card>
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-white">
            <ShieldIcon className="h-5 w-5" />
          </span>
          <h1 className="text-lg font-semibold tracking-tight">Sign in</h1>
          <p className="text-sm text-ink-2">
            Monitoring subscriptions and alerts are tied to your account.
          </p>
        </div>

        {sent ? (
          <p className="mt-6 rounded-md border border-hairline bg-surface-2 px-3 py-3 text-center text-sm text-ink-2">
            Check <strong className="text-ink">{email}</strong> for a sign-in link.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="h-9 rounded-md border border-line bg-surface px-3 text-sm outline-none focus:border-accent"
            />
            {error && <ErrorNotice>{error}</ErrorNotice>}
            <Button type="submit" variant="primary" loading={pending}>
              Send sign-in link
            </Button>
          </form>
        )}
      </Card>
    </main>
  );
}
