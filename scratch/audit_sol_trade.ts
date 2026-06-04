
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Searching for SOLUSDT positions opened today...");
  const positions = await prisma.position.findMany({
    where: {
      symbol: "SOLUSDT",
      openedAt: {
        gte: new Date(new Date().setHours(0, 0, 0, 0)),
      },
    },
    orderBy: {
      openedAt: "desc",
    },
  });

  if (positions.length === 0) {
    console.log("No SOLUSDT positions found for today.");
    return;
  }

  for (const pos of positions) {
    console.log("--- Position ---");
    console.log(`ID: ${pos.id}`);
    console.log(`Symbol: ${pos.symbol} ${pos.direction}`);
    console.log(`Entry: ${pos.entryPrice}`);
    console.log(`SL: ${pos.stopLoss}`);
    console.log(`TP: ${pos.takeProfit}`);
    console.log(`Opened At: ${pos.openedAt}`);
    console.log(`Strategy: ${pos.strategyName} (${pos.strategyId})`);
    console.log(`Market Regime: ${pos.marketRegime}`);
    
    // Check for ATR in indicatorSnapshot or auditPayload
    const indicators = pos.indicatorSnapshot as any;
    if (indicators) {
      console.log(`Indicators Snapshot ATR: ${indicators.atr}`);
    }

    const audit = pos.auditPayload as any;
    if (audit && audit.indicators) {
        console.log(`Audit Indicators ATR: ${audit.indicators.atr}`);
    }
    
    // Also search for the corresponding TradeSignal
    const signal = await prisma.tradeSignal.findFirst({
      where: {
        symbol: pos.symbol,
        direction: pos.direction,
        entry: pos.entryPrice,
        // Close enough timestamp
        timestamp: {
          gte: new Date(pos.openedAt.getTime() - 60000),
          lte: new Date(pos.openedAt.getTime() + 60000),
        }
      }
    });

    if (signal) {
      console.log("--- Corresponding TradeSignal ---");
      console.log(`ATR: ${signal.atr}`);
      console.log(`Timeframe: ${signal.timeframe}`);
      console.log(`Reasoning: ${signal.reasoning.join(", ")}`);
    }
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
