import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { computeRiskScore, getLatestRiskScore, type Explanations } from "../services/riskScoring";
import { checkRateLimit } from "../services/rateLimit";

function withParsedExplanations<T extends { explanations: string }>(score: T) {
  const { explanations, ...rest } = score;
  return { ...rest, explanations: JSON.parse(explanations) as Explanations };
}

export const riskScoreRouter = router({
  getByCompany: protectedProcedure
    .input(z.object({ companyId: z.string() }))
    .query(async ({ input }) => {
      const score = await getLatestRiskScore(input.companyId);
      return score ? withParsedExplanations(score) : null;
    }),

  recompute: protectedProcedure
    .input(z.object({ companyId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!checkRateLimit(`riskScore:recompute:${ctx.user.id}`, 5, 60_000)) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Recompute limit reached — try again in a minute.",
        });
      }
      const signalCount = await ctx.prisma.signal.count({ where: { companyId: input.companyId } });
      if (signalCount === 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Generate the dossier first — there are no gathered signals to score.",
        });
      }
      const score = await computeRiskScore(input.companyId);
      return withParsedExplanations(score);
    }),
});
