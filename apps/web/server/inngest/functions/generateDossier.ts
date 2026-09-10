import { inngest } from "../client";
import { runDossierPipeline } from "../../services/dossier";

// Inngest v4 two-argument createFunction: options (with triggers) + handler.
export const generateDossier = inngest.createFunction(
  {
    id: "generate-dossier",
    retries: 2,
    triggers: [{ event: "dossier/generate.requested" }],
  },
  async ({ event, step }) => {
    const companyId = event.data.companyId as string;
    return step.run("run-dossier-pipeline", async () => {
      const result = await runDossierPipeline(companyId);
      return { companyId, signalCount: result.signalCount };
    });
  }
);
