import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/server/auth";

// Magic-link landing point: trade the one-time code for a session cookie, then
// drop the user where they were originally headed.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");
  const target = next && next.startsWith("/") ? next : "/";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${target}`);
  }

  return NextResponse.redirect(`${origin}/login?error=link`);
}
