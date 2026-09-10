import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { recheckMonitoredCompany } from "../services/monitoring";
import { checkRateLimit } from "../services/rateLimit";

// Continuous monitoring is the recurring-revenue feature: gated behind the
// PRO plan. Free tier keeps one-time dossiers only.
function requirePro(plan: string) {
  if (plan !== "PRO") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Continuous monitoring requires the Pro plan.",
    });
  }
}

export const monitoringRouter = router({
  subscribe: protectedProcedure
    .input(
      z.object({
        companyId: z.string(),
        frequency: z.enum(["daily", "weekly"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requirePro(ctx.user.plan);
      // Start a new subscriber's watermark at the company's current state, so
      // their first check reports what changed since they subscribed rather
      // than replaying the whole existing backlog as "new".
      const [snapshot, score] = await Promise.all([
        ctx.prisma.signalSnapshot.findFirst({
          where: { companyId: input.companyId },
          orderBy: { takenAt: "desc" },
        }),
        ctx.prisma.riskScore.findFirst({
          where: { companyId: input.companyId },
          orderBy: { computedAt: "desc" },
        }),
      ]);
      return ctx.prisma.monitoredCompany.upsert({
        where: { userId_companyId: { userId: ctx.user.id, companyId: input.companyId } },
        update: { frequency: input.frequency, isActive: true },
        create: {
          userId: ctx.user.id,
          companyId: input.companyId,
          frequency: input.frequency,
          lastSnapshotId: snapshot?.id ?? null,
          lastNotifiedScore: score?.overallScore ?? null,
        },
      });
    }),

  unsubscribe: protectedProcedure
    .input(z.object({ companyId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.monitoredCompany.updateMany({
        where: { userId: ctx.user.id, companyId: input.companyId },
        data: { isActive: false },
      });
      return { ok: true };
    }),

  getAlerts: protectedProcedure
    .input(z.object({ unreadOnly: z.boolean().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const alerts = await ctx.prisma.monitoringAlert.findMany({
        where: {
          monitoredCompany: { userId: ctx.user.id },
          ...(input?.unreadOnly ? { isRead: false } : {}),
        },
        orderBy: { detectedAt: "desc" },
        take: 50,
        include: { monitoredCompany: { include: { company: true } } },
      });
      return alerts.map((a) => ({
        id: a.id,
        changeType: a.changeType,
        summary: a.summary,
        severity: a.severity,
        detectedAt: a.detectedAt,
        isRead: a.isRead,
        companyId: a.monitoredCompany.companyId,
        companyName: a.monitoredCompany.company.name,
      }));
    }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.prisma.monitoringAlert.updateMany({
      where: { monitoredCompany: { userId: ctx.user.id }, isRead: false },
      data: { isRead: true },
    });
    return { ok: true };
  }),

  // Manual "check now" — runs the same code path the scheduled Inngest
  // recheck uses, so changes are observable without waiting for the cron.
  recheckNow: protectedProcedure
    .input(z.object({ companyId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      requirePro(ctx.user.plan);
      if (!checkRateLimit(`monitoring:recheck:${ctx.user.id}`, 6, 60_000)) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Recheck limit reached — try again in a minute." });
      }
      const monitor = await ctx.prisma.monitoredCompany.findUnique({
        where: { userId_companyId: { userId: ctx.user.id, companyId: input.companyId } },
      });
      if (!monitor || !monitor.isActive) {
        throw new TRPCError({ code: "NOT_FOUND", message: "This company is not being monitored." });
      }
      return recheckMonitoredCompany(monitor.id);
    }),
});
