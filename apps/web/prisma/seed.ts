import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.user.upsert({
    where: { email: "demo@dossier.local" },
    update: {},
    create: {
      email: "demo@dossier.local",
      name: "Demo Analyst",
      plan: "FREE",
    },
  });

  // Real, well-covered companies so the live OSINT collectors return data.
  const seedCompanies = [
    { name: "Tesla", domain: "tesla.com", country: "US" },
    { name: "Infosys", domain: "infosys.com", country: "IN" },
  ];

  for (const c of seedCompanies) {
    const existing = await prisma.company.findFirst({ where: { name: c.name } });
    if (!existing) await prisma.company.create({ data: c });
  }

  console.log("Seeded demo user and sample companies.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
