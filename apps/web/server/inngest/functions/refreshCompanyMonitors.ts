import { inngest } from "../client";
import { recheckCompanyForDueSubscribers } from "../../services/monitoring";

// Refreshes one company's OSINT signals, then fans the resulting diff out to
// every subscriber of that company that is currently due — each gets alerts
// for what is new relative to their own watermark.
export const refreshCompanyMonitorsFn = inngest.createFunction(
  {
    id: "refresh-company-monitors",
    retries: 2,
    triggers: [{ event: "monitoring/company.recheck" }],
  },
  async ({ event, step }) => {
    const companyId = event.data.companyId as string;
    return step.run("refresh-and-notify", () => recheckCompanyForDueSubscribers(companyId));
  }
);
