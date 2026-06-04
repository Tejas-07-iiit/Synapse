
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Auditing last 20 trades for mode consistency...");
  
  const trades = await prisma.trade.findMany({
    take: 20,
    orderBy: { openedAt: "desc" },
    include: {
      user: {
        include: {
          settings: true
        }
      }
    }
  });

  if (trades.length === 0) {
    console.log("No trades found.");
    return;
  }

  console.log("Symbol | Trade OpenedAt | User Selected Mode (Current) | Trade Table Mode | Executive Summary Mode");
  console.log("--------------------------------------------------------------------------------------------------");

  for (const trade of trades) {
    const userSelectedMode = trade.user.settings?.preferredTradingMode || "N/A";
    const tradeTableMode = (trade as any).tradingMode || "NULL";
    
    let summaryMode = "NOT_FOUND";
    const audit = trade.auditPayload as any;
    if (audit && audit.executiveSummary) {
      const match = audit.executiveSummary.match(/under (SCALPING|INTRADAY) mode/);
      if (match) {
        summaryMode = match[1];
      }
    }

    console.log(`${trade.symbol.padEnd(8)} | ${trade.openedAt.toISOString()} | ${userSelectedMode.padEnd(12)} | ${tradeTableMode.padEnd(10)} | ${summaryMode}`);
  }

  // Also check the latest TradeSignals
  console.log("\nLatest 10 TradeSignals:");
  const signals = await prisma.tradeSignal.findMany({
    take: 10,
    orderBy: { timestamp: "desc" },
  });
  
  console.log("Symbol | Signal Timestamp | Signal Table Mode | Blocked | Reason");
  console.log("------------------------------------------------------------------");
  for (const sig of signals) {
     console.log(`${sig.symbol.padEnd(8)} | ${sig.timestamp.toISOString()} | ${sig.tradingMode?.padEnd(10)} | ${sig.blocked} | ${sig.blockReason?.substring(0, 40)}`);
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
