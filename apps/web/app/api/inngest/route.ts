import { serve } from "inngest/next";
import { inngest } from "@/server/inngest/client";
import {
  generateDossier,
  monitoringDispatcher,
  refreshCompanyMonitorsFn,
} from "@/server/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [generateDossier, monitoringDispatcher, refreshCompanyMonitorsFn],
});
