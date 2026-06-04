
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const userId = "edf316a9-46ee-4fb2-a538-ca2f65bb33f7";
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
