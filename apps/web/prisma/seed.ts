import { PrismaClient } from "@prisma/client";
import { runDossierPipeline } from "../server/services/dossier";

const prisma = new PrismaClient();

// Real, well-covered companies with distinctive legal names, so the live OSINT
// collectors return meaningful data rather than the name-collision noise a
// generic word produces.
const SEED_COMPANIES = [
  { name: "Tesla", domain: "tesla.com", country: "US" },
  { name: "Infosys", domain: "infosys.com", country: "IN" },
  { name: "Wells Fargo", domain: "wellsfargo.com", country: "US" },
  { name: "Boeing", domain: "boeing.com", country: "US" },
];

async function main() {
  await prisma.user.upsert({
    where: { email: "demo@dossier.local" },
    update: {},
    create: { email: "demo@dossier.local", name: "Demo Analyst", plan: "FREE" },
  });

  for (const c of SEED_COMPANIES) {
    const existing = await prisma.company.findFirst({ where: { name: c.name } });
    if (!existing) await prisma.company.create({ data: c });
  }

  // Pre-generate dossiers so a first-time visitor lands on a populated
  // dashboard instead of an empty one, and never has to sit through a cold
  // collection to see what the app does. Skips companies already scored, so
  // re-running the seed is cheap.
  for (const c of SEED_COMPANIES) {
    const company = await prisma.company.findFirstOrThrow({ where: { name: c.name } });
    const scored = await prisma.riskScore.count({ where: { companyId: company.id } });
    if (scored > 0) {
      console.log(`- ${c.name}: already scored, skipping`);
      continue;
    }
    try {
      const result = await runDossierPipeline(company.id);
      console.log(
        `- ${c.name}: ${result.signalCount} signals, risk ${result.riskScore.overallScore}/100`
      );
    } catch (err) {
      // A flaky upstream during seeding must not abort the whole seed.
      console.error(`- ${c.name}: dossier generation failed —`, err);
    }
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
