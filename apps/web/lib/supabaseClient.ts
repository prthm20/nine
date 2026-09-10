import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client for the login form. Uses the anon key, which is
// safe to ship — row access is governed by Supabase policies, and the app's own
// data is reached through tRPC, never directly from the browser.
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
