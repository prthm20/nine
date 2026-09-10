import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, isAuthConfigured } from "@/server/auth";

export async function POST(request: NextRequest) {
  if (isAuthConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
