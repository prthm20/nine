import { router, protectedProcedure } from "../trpc";

export const billingRouter = router({
  getPlan: protectedProcedure.query(({ ctx }) => ({ plan: ctx.user.plan })),

  // Razorpay integration point. Real flow:
  //   1. create a Razorpay subscription server-side (plan mapped to PRO),
  //   2. return the subscription id for Razorpay Checkout on the client,
  //   3. flip user.plan to PRO in the subscription.activated webhook handler
  //      (and back to FREE on cancellation/halt webhooks).
  // The demo mutation flips the plan directly so the monitoring gate is testable.
  upgradeToProDemo: protectedProcedure.mutation(async ({ ctx }) => {
    const user = await ctx.prisma.user.update({
      where: { id: ctx.user.id },
      data: { plan: "PRO" },
    });
    return { plan: user.plan };
  }),

  downgradeToFreeDemo: protectedProcedure.mutation(async ({ ctx }) => {
    const user = await ctx.prisma.user.update({
      where: { id: ctx.user.id },
      data: { plan: "FREE" },
    });
    return { plan: user.plan };
  }),
});
