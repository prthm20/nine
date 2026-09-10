import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { runDossierPipeline } from "../services/dossier";
import { checkRateLimit } from "../services/rateLimit";

export const dossierRouter = router({
  // Runs the pipeline inline so the demo works without an Inngest dev server.
  // In production, prefer emitting the event and letting the background
  // function do the work: inngest.send({ name: "dossier/generate.requested",
  // data: { companyId } }).
  generate: protectedProcedure
    .input(z.object({ companyId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!checkRateLimit(`dossier:${ctx.user.id}`, 10, 60_000)) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Slow down — try again in a minute." });
      }
      const result = await runDossierPipeline(input.companyId);
      return { signalCount: result.signalCount, overallScore: result.riskScore.overallScore };
    }),
});
