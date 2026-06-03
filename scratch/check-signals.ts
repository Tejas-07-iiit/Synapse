import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== TRADESIGNAL RECORDS ===");
  const signals = await prisma.tradeSignal.findMany({
    orderBy: { timestamp: "desc" },
    take: 50,
  });
  console.log("Found", signals.length, "signals");
  console.log(JSON.stringify(signals.map(s => ({
    id: s.id,
    symbol: s.symbol,
    timeframe: s.timeframe,
    strategyId: s.strategyId,
    direction: s.direction,
    userId: s.userId,
    blocked: s.blocked,
    blockReason: s.blockReason,
    timestamp: s.timestamp
  })), null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
