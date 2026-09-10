import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { prisma } from "./db";

// Real identity, replacing the hardcoded demo user. Everything downstream
// (monitors, alerts, plan gating) already keys off ctx.user, so this is the
// only place that needed to learn who is asking.
//
// Auth stays optional: with Supabase env vars unset the app runs in demo mode
// against a single local user, exactly as before, so `npm run dev` still works
// with zero external setup.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function isAuthConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component, where cookies are read-only. The
          // proxy refreshes the session cookies instead, so this is safe.
        }
      },
    },
  });
}

/**
 * Resolve the Supabase session to the local User row that owns monitors and
 * alerts. The local row is keyed by email, which Supabase has already
 * verified, so a returning user reattaches to their existing subscriptions.
 */
export async function getSessionUser() {
  if (!isAuthConfigured()) return null;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const name =
    (user.user_metadata?.full_name as string | undefined) ?? user.email.split("@")[0];

  return prisma.user.upsert({
    where: { email: user.email },
    update: {},
    create: { email: user.email, name, plan: "FREE" },
  });
}
