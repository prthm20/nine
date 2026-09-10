import { router } from "../trpc";
import { companyRouter } from "./company";
import { dossierRouter } from "./dossier";
import { riskScoreRouter } from "./riskScore";
import { monitoringRouter } from "./monitoring";
import { billingRouter } from "./billing";
import { authRouter } from "./auth";

export const appRouter = router({
  company: companyRouter,
  dossier: dossierRouter,
  riskScore: riskScoreRouter,
  monitoring: monitoringRouter,
  billing: billingRouter,
  auth: authRouter,
});

export type AppRouter = typeof appRouter;
