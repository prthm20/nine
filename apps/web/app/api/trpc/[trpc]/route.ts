import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/routers/_app";
import { createContext } from "@/server/context";

// Dossier generation and monitoring rechecks query four OSINT sources inline
// (~6s measured, and upstreams are slow before they are fast), which overruns
// the default serverless function limit. Raise the ceiling for this route.
export const maxDuration = 60;

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext,
  });

export { handler as GET, handler as POST };
