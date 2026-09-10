import { inngest } from "../client";
import { findDueCompanyIds } from "../../services/monitoring";

// Daily dispatcher: finds every company with at least one active subscriber
// due for a check (daily subscribers older than 24h, weekly older than 7d)
// and fans out one refresh event per company. Fanning out per company rather
// than per subscriber means the OSINT sources are queried once regardless of
// how many people watch that company; the refresh then notifies each due
// subscriber individually.
export const monitoringDispatcher = inngest.createFunction(
  {
    id: "monitoring-dispatcher",
    triggers: [{ cron: "0 6 * * *" }],
  },
  async ({ step }) => {
    const dueIds = await step.run("find-due-companies", () => findDueCompanyIds());

    if (dueIds.length > 0) {
      await step.sendEvent(
        "fan-out-refreshes",
        dueIds.map((companyId) => ({
          name: "monitoring/company.recheck",
          data: { companyId },
        }))
      );
    }

    return { dispatched: dueIds.length };
  }
);
