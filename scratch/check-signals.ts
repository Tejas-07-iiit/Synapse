import prisma from "../lib/prisma";

async function run() {
  console.log("Checking signals, trades and events...");
  const signalsCount = await prisma.tradeSignal.count();
  console.log(`Total TradeSignals (crypto/general): ${signalsCount}`);

  const mcxPositions = await prisma.mcxPosition.findMany();
  console.log(`Total MCX Positions: ${mcxPositions.length}`);
  for (const pos of mcxPositions) {
    console.log(`- Position ${pos.id}: symbol=${pos.symbol}, side=${pos.side}, status=${pos.status}, entryPrice=${pos.entryPrice}, exitPrice=${pos.exitPrice}, pnl=${pos.pnl}`);
  }

  const mcxTrades = await prisma.mcxTrade.findMany();
  console.log(`Total MCX Trades: ${mcxTrades.length}`);

  const signalEvents = await prisma.mcxEventLog.findMany({
    where: { type: "SIGNAL_GENERATED" },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  console.log(`Sample MCX SIGNAL_GENERATED event logs: ${signalEvents.length}`);
  for (const ev of signalEvents) {
    console.log(`- Event: timestamp=${ev.createdAt.toISOString()}, payload=${JSON.stringify(ev.payload)}`);
  }

  const errorEvents = await prisma.mcxEventLog.findMany({
    where: { type: { in: ["ENTRY_FAILED", "EXIT_FAILED"] } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  console.log(`Sample MCX Execution/Error event logs: ${errorEvents.length}`);
  for (const ev of errorEvents) {
    console.log(`- Event type=${ev.type}: ${JSON.stringify(ev.payload)}`);
  }
}

run()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
