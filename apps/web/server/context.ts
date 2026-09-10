import { prisma } from "./db";
import { getSessionUser, isAuthConfigured } from "./auth";

const DEMO_EMAIL = "demo@dossier.local";

// With Supabase configured, ctx.user is the signed-in user (null when signed
// out — protectedProcedure turns that into UNAUTHORIZED). Without it, the app
// falls back to a single demo user so local dev and the demo need no setup.
export async function createContext() {
  if (isAuthConfigured()) {
    return { prisma, user: await getSessionUser() };
  }

  let user = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (!user) {
    user = await prisma.user.create({
      data: { email: DEMO_EMAIL, name: "Demo Analyst", plan: "FREE" },
    });
  }
  return { prisma, user };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
