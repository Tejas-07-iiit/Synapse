import { PrismaClient } from "@prisma/client";
import { mcxConfig } from "../src/mcx/config/mcx.config";

const prisma = new PrismaClient();

async function main() {
  console.log("--- INITIATING DATABASE FACTORY RESET ---");

  // 1. Wipe Trading History
  const deletedTrades = await prisma.mcxTrade.deleteMany({});
  const deletedPositions = await prisma.mcxPosition.deleteMany({});
  const deletedLocks = await prisma.mcxExecutionLock.deleteMany({});
  console.log(`[TRADING] Wiped ${deletedTrades.count} Trades, ${deletedPositions.count} Positions, ${deletedLocks.count} Locks.`);

  // 2. Reset Wallet
  const userId = mcxConfig.runtime.defaultUserId;
  await prisma.mcxWallet.upsert({
    where: { userId },
    create: {
      userId,
      equity: 1000000,
      availableBalance: 1000000,
      blockedMargin: 0,
      realizedPnL: 0,
      unrealizedPnL: 0,
      tradingHalted: false,
      dayStartEquity: 1000000,
      highWatermarkEquity: 1000000,
      riskConfigVersion: 'mcx-risk-v2',
    },
    update: {
      tradingHalted: false,
      haltReason: null,
      realizedPnL: 0,
      unrealizedPnL: 0,
      equity: 1000000,
      availableBalance: 1000000,
      dayStartEquity: 1000000,
      highWatermarkEquity: 1000000,
      blockedMargin: 0
    }
  });
  console.log(`[WALLET] Reset equity to ₹1,000,000 and removed all risk locks for ${userId}.`);

  // 3. Wipe Market Data (to force a clean backfill of correct contracts)
  const deletedTicks = await prisma.mcxTick.deleteMany({});
  const deletedCandles = await prisma.mcxCandle.deleteMany({});
  console.log(`[MARKET DATA] Purged ${deletedTicks.count} Ticks and ${deletedCandles.count} Candles.`);

  console.log("--- FACTORY RESET COMPLETE ---");
}

main().catch(console.error).finally(() => prisma.$disconnect());
