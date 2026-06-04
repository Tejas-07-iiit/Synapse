
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const userId = "104ba44e-6e4e-41e6-b764-d14a0a7b29e2";
  console.log(`Auditing summaries for user 'tejas 1' (${userId})...`);
  const trades = await prisma.trade.findMany({
    where: { userId },
    orderBy: { openedAt: "desc" },
    take: 5
  });

  for (const trade of trades) {
    console.log(`--- Trade ${trade.id} (${trade.symbol}) ---`);
    console.log(`Opened At: ${trade.openedAt.toISOString()}`);
    console.log(`Summary: ${(trade.auditPayload as any)?.executiveSummary}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
