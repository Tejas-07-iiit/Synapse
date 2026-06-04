
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const userId = "edf316a9-46ee-4fb2-a538-ca2f65bb33f7";
  console.log(`Auditing trades for user 'tejas intraday' (${userId})...`);
  
  const trades = await prisma.trade.findMany({
    where: { userId },
    orderBy: { openedAt: "desc" },
    take: 10
  });

  if (trades.length === 0) {
    console.log("No trades found for this user.");
    return;
  }

  console.log("Symbol | OpenedAt | Strategy | Executive Summary Mode");
  console.log("-------------------------------------------------------");

  for (const trade of trades) {
    let summaryMode = "NOT_FOUND";
    const audit = trade.auditPayload as any;
    if (audit && audit.executiveSummary) {
      const match = audit.executiveSummary.match(/under (SCALPING|INTRADAY) mode/);
      if (match) {
        summaryMode = match[1];
      }
    }

    console.log(`${trade.symbol.padEnd(8)} | ${trade.openedAt.toISOString()} | ${trade.strategyName.padEnd(20)} | ${summaryMode}`);
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
