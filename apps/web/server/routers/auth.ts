import { router, publicProcedure } from "../trpc";
import { isAuthConfigured } from "../auth";

export const authRouter = router({
  // Drives the header's identity chip. Public so the login page and a
  // signed-out shell can render without tripping the protected guard.
  me: publicProcedure.query(({ ctx }) => ({
    authEnabled: isAuthConfigured(),
    user: ctx.user ? { email: ctx.user.email, name: ctx.user.name } : null,
  })),
});
