import type { Company, MonitoringAlert, User } from "@prisma/client";

// Out-of-app alert delivery. The in-app bell only reaches someone who happens
// to have the tab open, so monitoring alerts are also emailed to the
// subscriber that owns them.
//
// Like the AICredits client, this goes straight to the provider's HTTP API
// (no SDK) and degrades to a logged no-op when unconfigured, so the demo and
// local dev keep working without an outbound mail provider.
const RESEND_URL = "https://api.resend.com/emails";

const SEVERITY_ORDER: Record<string, number> = { high: 3, medium: 2, low: 1 };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function subjectFor(company: Company, alerts: MonitoringAlert[]): string {
  const worst = [...alerts].sort(
    (a, b) => (SEVERITY_ORDER[b.severity] ?? 0) - (SEVERITY_ORDER[a.severity] ?? 0)
  )[0];
  const prefix = worst.severity === "high" ? "High-severity risk change" : "Risk change";
  return alerts.length === 1
    ? `${prefix}: ${company.name}`
    : `${prefix}: ${company.name} (${alerts.length} alerts)`;
}

function bodyFor(company: Company, alerts: MonitoringAlert[], appUrl: string): string {
  const items = alerts
    .map(
      (a) =>
        `<li><strong>${escapeHtml(a.severity)}</strong> &middot; ${escapeHtml(
          a.changeType
        )}<br>${escapeHtml(a.summary)}</li>`
    )
    .join("");
  return [
    `<p>New risk activity for <strong>${escapeHtml(company.name)}</strong>:</p>`,
    `<ul>${items}</ul>`,
    `<p><a href="${appUrl}/companies/${company.id}">Open the dossier</a></p>`,
  ].join("");
}

export async function sendAlertEmail(
  user: Pick<User, "email" | "name">,
  company: Company,
  alerts: MonitoringAlert[]
): Promise<void> {
  if (alerts.length === 0) return;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.info(
      `[notifier] ${alerts.length} alert(s) for ${company.name} → ${user.email} (email disabled: RESEND_API_KEY unset)`
    );
    return;
  }

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: process.env.ALERT_EMAIL_FROM ?? "alerts@dossier.local",
        to: [user.email],
        subject: subjectFor(company, alerts),
        html: bodyFor(company, alerts, appUrl),
      }),
    });
    if (!res.ok) {
      console.error(`[notifier] send failed: ${res.status} ${await res.text()}`);
    }
  } catch (err) {
    // Alerts are already persisted; a mail outage must never sink a recheck.
    console.error("[notifier] send errored:", err);
  }
}
