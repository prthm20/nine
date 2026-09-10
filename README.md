# Company Risk Dossier Generator

OSINT-powered company risk dossiers with **explainable risk scoring** (Feature 1) and
**continuous monitoring with alerts** (Feature 2), per the "Next Level" feature plan.

**Stack:** Next.js 16 (App Router, `proxy.ts`), tRPC v11, Prisma 6, Inngest v4,
Tailwind v4, TanStack Query. AI explanations call AICredits
(`https://aicredits.in/v1/chat/completions`) directly via fetch.

## Live OSINT sources (keyless, real URLs)

| Category | Sources |
|---|---|
| Reputational | Google News RSS — adverse-media search (real article links) |
| Legal | CourtListener API — US court/docket records; legal-keyword news |
| Financial | SEC EDGAR full-text search — NT 10-K/NT 10-Q late-filing notifications (direct sec.gov document links); financial-distress news |
| Cyber | dns.google — live SPF/DMARC checks on the company domain; crt.sh certificate-transparency; breach/ransomware news |

All sources fail soft (one flaky upstream never sinks a dossier). Sentiment and
severity come from a documented keyword heuristic in
`server/services/osint/collectors.ts`.

**Name matching caveat:** collectors match by company name. Distinctive legal
names work best — a company named "boat" will also pull literal boats. Signals
are framed as *potential matches requiring review*; proper entity resolution
(aliases, confidence scores, review workflow) arrives with the sanctions
watchlist feature (Feature 3). Set the company **domain** to enable the cyber
DNS/certificate checks.

## Quick start

```bash
npm install
npm run db:migrate -w web   # creates the local SQLite dev DB
npm run db:seed -w web      # demo user + real sample companies (Tesla, Infosys)
npm run dev                 # http://localhost:3000
```

The database is SQLite (`apps/web/prisma/dev.db`) and AI explanations fall back
to deterministic, citation-bearing templates when `AICREDITS_API_KEY` is unset.
Optional env: `COURTLISTENER_API_TOKEN` (raises rate limits) and
`SEC_EDGAR_USER_AGENT` (SEC asks for an identifying User-Agent).

### Demo flow

1. Open a company → **Generate dossier** (queries the live sources above, snapshots the signal set, computes a risk score).
2. Expand any category in the score breakdown to see the plain-English explanation plus the weighted evidence — every factor links to its real source (court docket, SEC filing, article, DNS record).
3. **Upgrade to Pro** (header) — monitoring is gated to the Pro plan; the free tier gets one-time dossiers only.
4. **Enable monitoring** (daily/weekly) → **Check now** re-queries the sources and alerts on new signals or material score moves. Real coverage changes over days, so back-to-back rechecks correctly report "no meaningful changes".
5. To demo alerts without waiting for the news cycle:
   `npx tsx scripts/simulate-change.ts <companyId>` (run in `apps/web`), then **Check now** — you'll get a `new_signal` and a `score_change` alert in the bell.

## Architecture

```
apps/web/
  prisma/schema.prisma          # User, Company, Signal, SignalSnapshot,
                                # RiskScore/RiskFactor (F1), MonitoredCompany/MonitoringAlert (F2)
  proxy.ts                      # Next 16 middleware (auth hook point)
  server/
    context.ts                  # demo user — swap for Supabase auth here
    config/riskWeights.ts       # category weights; override via RISK_WEIGHTS_JSON
    services/
      osint/collectors.ts       # live collectors: Google News, CourtListener,
                                # SEC EDGAR, dns.google, crt.sh
      dossier.ts                # pipeline: collect → persist → snapshot → score
      riskScoring.ts            # F1: sub-scores, weighted factors, AI explanations
      monitoring.ts             # F2: due-monitor query, snapshot diff, alerts
      aiClient.ts               # AICredits chat completions (fetch, no SDK)
    inngest/functions/          # v4 two-arg createFunction:
                                #   generateDossier (event)
                                #   monitoringDispatcher (cron 06:00, fans out)
                                #   recheckMonitoredCompany (event)
    routers/                    # tRPC: company, dossier, riskScore, monitoring, billing
```

- **Scoring:** each signal contributes `severity × negativity`; category scores use a
  saturating curve into 0–100; overall is the weight-configurable average. Factors store
  each signal's share of category impact, so every score decomposes into cited evidence.
- **Monitoring:** rechecks re-collect sources, diff against the last `SignalSnapshot`
  fingerprint, alert on new signals and ≥5-point score moves, then recompute the score.
  The tRPC `recheckNow` and the Inngest cron path share the same service code.
- **Billing:** `billing.upgradeToProDemo` flips the plan directly; the real Razorpay
  subscription + webhook flow is documented at the integration point in
  `server/routers/billing.ts`.

## Background jobs (optional in dev)

The UI works without Inngest (pipeline runs inline). To run the scheduled
monitoring locally:

```bash
npx inngest-cli@latest dev   # alongside `npm run dev`
```

## Switching to Supabase Postgres

1. In `apps/web/prisma/schema.prisma`, set `provider = "postgresql"`.
2. Point `DATABASE_URL` at the Supabase connection string.
3. `npm run db:migrate -w web`.

The schema intentionally avoids SQLite-only or Postgres-only types (string unions
instead of enums, JSON stored as strings) so it is portable across both.

## Next up (from the feature plan)

- **Feature 3 — Sanctions & watchlist cross-check:** weekly Inngest ingestion of
  OFAC SDN / UN Consolidated lists into a `WatchlistEntry` table + fuzzy matching.
- **Feature 4 — Network/relationship graph:** `Entity`/`EntityRelationship` models
  + force-directed graph on the dossier page.
