import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { normalizeDomain } from "../services/osint/collectors";

export const companyRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const companies = await ctx.prisma.company.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        riskScores: { orderBy: { computedAt: "desc" }, take: 1 },
        monitors: { where: { userId: ctx.user.id, isActive: true } },
        _count: { select: { signals: true } },
      },
    });
    return companies.map((c) => ({
      id: c.id,
      name: c.name,
      domain: c.domain,
      country: c.country,
      signalCount: c._count.signals,
      latestScore: c.riskScores[0] ?? null,
      isMonitored: c.monitors.length > 0,
    }));
  }),

  getById: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const company = await ctx.prisma.company.findUnique({
      where: { id: input.id },
      include: {
        signals: { orderBy: [{ category: "asc" }, { severity: "desc" }] },
        monitors: { where: { userId: ctx.user.id } },
      },
    });
    if (!company) throw new TRPCError({ code: "NOT_FOUND" });
    return {
      id: company.id,
      name: company.name,
      domain: company.domain,
      country: company.country,
      signals: company.signals,
      monitor: company.monitors[0] ?? null,
    };
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2).max(120),
        domain: z.string().max(200).optional(),
        country: z.string().max(60).optional(),
      })
    )
    .mutation(({ ctx, input }) =>
      ctx.prisma.company.create({
        data: { name: input.name.trim(), domain: normalizeDomain(input.domain), country: input.country },
      })
    ),
});
