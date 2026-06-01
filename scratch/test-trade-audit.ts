import { PrismaClient } from "@prisma/client";
import { PaperTradingEngine } from "../src/execution-engine/paper";
import { useWalletStore } from "../src/stores/walletStore";
import { useSettingsStore } from "../src/stores/settingsStore";
import { useAuthStore } from "../store/useAuthStore";

const prisma = new PrismaClient();

async function testTradeAuditPipeline() {
  const userId = "test-audit-user-888";
  console.log(`\n=== Running Trade Intelligence & Execution Audit Pipeline Test ===\n`);

  try {
    // 1. Clean up database records for the test user to guarantee a clean state
    console.log("[TEST] Cleaning up previous test data in database...");
    await prisma.trade.deleteMany({ where: { userId } });
    await prisma.position.deleteMany({ where: { userId } });
    await prisma.userSettings.deleteMany({ where: { userId } });
    await prisma.wallet.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });

    // 2. Create the test user and their wallet/settings
    console.log("[TEST] Creating test user, settings, and wallet...");
    await prisma.user.create({
      data: {
        id: userId,
        username: "audit_tester",
        email: "audit@synapse.ai",
        passwordHash: "mock-password-hash",
      },
    });

    const wallet = await prisma.wallet.create({
      data: {
        userId,
        balance: 10000,
        totalDeposited: 10000,
        realizedPnl: 0,
      },
    });
    console.log(`[TEST] Wallet balance initialized: $${wallet.balance}`);

    await prisma.userSettings.create({
      data: {
        userId,
        autoTrading: true,
        defaultSlPct: 2.0,
        defaultTpPct: 4.0,
        maxOpenTrades: 3,
        riskPerTradePct: 5.0,
      },
    });

    // 3. Register DB handler on PaperTradingEngine
    console.log("[TEST] Registering direct Prisma DB handlers to PaperTradingEngine...");
    PaperTradingEngine.registerDbHandler({
      fetchActivePositions: async (uid: string) => {
        return prisma.position.findMany({
          where: { userId: uid, status: "OPEN" },
        });
      },
      openPosition: async (data: any) => {
        return prisma.position.create({
          data: {
            userId: data.userId,
            symbol: data.symbol,
            direction: data.direction,
            entryPrice: data.entryPrice,
            currentPrice: data.entryPrice,
            quantity: data.quantity,
            stopLoss: data.stopLoss,
            takeProfit: data.takeProfit,
            leverage: data.leverage,
            pnl: 0.0,
            status: "OPEN",
            strategyId: data.strategyId || null,
            strategyName: data.strategyName || null,
            strategyCategory: data.strategyCategory || null,
            entryReason: data.entryReason || null,
            confidenceAtEntry: data.confidenceAtEntry || null,
            marketRegime: data.marketRegime || null,
            indicatorSnapshot: data.indicatorSnapshot || null,
          },
        });
      },
      updatePosition: async (id: string, currentPrice: number, pnl: number) => {
        return prisma.position.update({
          where: { id },
          data: { currentPrice, pnl },
        });
      },
      closePosition: async (data: any) => {
        const {
          id,
          exitPrice,
          pnl,
          closedAt,
          openedAt,
          userId: uid,
          symbol,
          direction,
          entryPrice,
          stopLoss,
          takeProfit,
          leverage,
          reason,
          strategyId,
          strategyName,
          strategyCategory,
          entryReason,
          confidenceAtEntry,
          marketRegime,
          indicatorSnapshot,
          exitReason,
        } = data;

        await prisma.position.update({
          where: { id },
          data: {
            status: "CLOSED",
            currentPrice: exitPrice,
            pnl,
            closedAt: new Date(closedAt),
          },
        });

        let tradeStatus = "CLOSED";
        if (reason === "STOP_LOSS" || reason === "STOPPED" || reason === "SL HIT") {
          tradeStatus = "STOPPED";
        } else if (reason === "TAKE_PROFIT" || reason === "TP HIT") {
          tradeStatus = "TP HIT";
        }

        const isLong = direction === "LONG";
        const priceDiff = isLong ? exitPrice - entryPrice : entryPrice - exitPrice;
        const roi = (priceDiff / entryPrice) * 100 * leverage;

        await prisma.trade.create({
          data: {
            userId: uid,
            symbol,
            strategyName: strategyName || "Central Engine",
            strategyId: strategyId || null,
            strategyCategory: strategyCategory || null,
            entryReason: entryReason || null,
            exitReason: exitReason || null,
            confidenceAtEntry: confidenceAtEntry || null,
            confidence: confidenceAtEntry || 0.8,
            marketRegime: marketRegime || null,
            indicatorSnapshot: indicatorSnapshot || null,
            direction,
            entryPrice,
            exitPrice,
            currentPrice: exitPrice,
            stopLoss,
            takeProfit,
            quantity: data.quantity || 0,
            leverage,
            pnl,
            roi,
            status: tradeStatus,
            openedAt: new Date(openedAt),
            closedAt: new Date(closedAt),
            executionType: "PAPER",
          },
        });

        await prisma.wallet.update({
          where: { userId: uid },
          data: {
            balance: { increment: pnl },
            realizedPnl: { increment: pnl },
          },
        });
      },
      fetchWallet: async (uid: string) => {
        return prisma.wallet.findUnique({
          where: { userId: uid },
        });
      },
    });

    // 4. Initialize client Zustand stores in-memory for the engine
    console.log("[TEST] Initializing client stores...");
    useWalletStore.setState({
      balance: 10000,
      totalDeposited: 10000,
      realizedPnl: 0,
    });
    useSettingsStore.setState({
      autoTrading: true,
      riskPerTradePct: 5.0,
      maxOpenTrades: 3,
      defaultSlPct: 2.0,
      defaultTpPct: 4.0,
    });
    useAuthStore.setState({
      user: { id: userId, username: "audit_tester", email: "audit@synapse.ai" } as any,
    });

    // 5. Load positions
    await PaperTradingEngine.loadActivePositions(userId);

    // 6. Define mock strategy signal context
    const mockSignal = {
      strategyId: "ema-cross-adx",
      strategyName: "EMA Cross ADX",
      strategyCategory: "Trend Following",
      symbol: "BTCUSDT",
      timeframe: "15m",
      signal: "LONG",
      confidence: 85,
      entry: 50000,
      stopLoss: 49000,
      takeProfit: 52000,
      reasoning: ["EMA 12 crossed EMA 26 upwards", "ADX shows strong trend strength (>25)"],
      indicators: { rsi: 62.4, adx: 28.1, ema12: 50120, ema26: 50050 },
      marketContext: { regime: "BULLISH_TREND" },
      timestamp: Date.now(),
    };

    // 7. Open position
    console.log("\n--- STEP 1: Opening Position with Strategy Context ---");
    const pos = await PaperTradingEngine.openPosition(
      userId,
      "BTCUSDT",
      "LONG",
      50000,
      null, // auto-size
      49000, // stopLoss
      52000, // takeProfit
      1, // leverage
      10000, // explicit balance
      {
        autoTrading: true,
        maxOpenTrades: 3,
        riskPerTradePct: 5.0,
      },
      mockSignal
    );

    if (!pos) {
      throw new Error("Failed to open position with strategy context.");
    }
    console.log(`[TEST] SUCCESS: Opened Position ID: ${pos.id}`);

    // Assert that the position has the fields saved in database
    console.log("[TEST] Verifying Position database fields...");
    const dbPos = await prisma.position.findUnique({
      where: { id: pos.id },
    });

    if (!dbPos) {
      throw new Error("Position not found in database.");
    }

    console.log("Database Position Data:");
    console.log(`- strategyId: ${dbPos.strategyId} (Expected: "ema-cross-adx")`);
    console.log(`- strategyName: ${dbPos.strategyName} (Expected: "EMA Cross ADX")`);
    console.log(`- strategyCategory: ${dbPos.strategyCategory} (Expected: "Trend Following")`);
    console.log(`- entryReason: ${dbPos.entryReason} (Expected: containing reasoning)`);
    console.log(`- confidenceAtEntry: ${dbPos.confidenceAtEntry} (Expected: 0.85)`);
    console.log(`- marketRegime: ${dbPos.marketRegime} (Expected: "BULLISH_TREND")`);
    console.log(`- indicatorSnapshot: ${JSON.stringify(dbPos.indicatorSnapshot)}`);

    if (dbPos.strategyId !== "ema-cross-adx") throw new Error("Incorrect strategyId in Position");
    if (dbPos.strategyName !== "EMA Cross ADX") throw new Error("Incorrect strategyName in Position");
    if (dbPos.strategyCategory !== "Trend Following") throw new Error("Incorrect strategyCategory in Position");
    if (!dbPos.entryReason?.includes("EMA 12 crossed")) throw new Error("Incorrect entryReason in Position");
    if (dbPos.confidenceAtEntry !== 0.85) throw new Error("Incorrect confidenceAtEntry in Position");
    if (dbPos.marketRegime !== "BULLISH_TREND") throw new Error("Incorrect marketRegime in Position");
    if (!dbPos.indicatorSnapshot) throw new Error("Missing indicatorSnapshot in Position");

    console.log("[TEST] ✅ Position fields verified successfully.");

    // 8. Close position simulating TP Hit
    console.log("\n--- STEP 2: Closing Position (Simulating Take Profit Hit) ---");
    const exitPrice = 52100;
    const closed = await PaperTradingEngine.closePosition(pos.id, exitPrice, "TAKE_PROFIT");
    if (!closed) {
      throw new Error("Failed to close position.");
    }

    // Verify DB Position is CLOSED
    const dbPosAfterClose = await prisma.position.findUnique({
      where: { id: pos.id },
    });
    if (dbPosAfterClose?.status !== "CLOSED") {
      throw new Error("Position status was not updated to CLOSED in database.");
    }
    console.log("[TEST] Position updated to CLOSED in DB.");

    // Verify Trade record
    console.log("[TEST] Verifying Trade database fields...");
    const dbTrade = await prisma.trade.findFirst({
      where: { userId, symbol: "BTCUSDT" },
    });

    if (!dbTrade) {
      throw new Error("Trade record not found in database.");
    }

    console.log("Database Trade Data:");
    console.log(`- strategyId: ${dbTrade.strategyId} (Expected: "ema-cross-adx")`);
    console.log(`- strategyName: ${dbTrade.strategyName} (Expected: "EMA Cross ADX")`);
    console.log(`- strategyCategory: ${dbTrade.strategyCategory} (Expected: "Trend Following")`);
    console.log(`- entryReason: ${dbTrade.entryReason} (Expected: containing entry reasoning)`);
    console.log(`- exitReason: ${dbTrade.exitReason} (Expected: containing "Take Profit reached")`);
    console.log(`- confidenceAtEntry: ${dbTrade.confidenceAtEntry} (Expected: 0.85)`);
    console.log(`- confidence: ${dbTrade.confidence} (Expected: 0.85)`);
    console.log(`- marketRegime: ${dbTrade.marketRegime} (Expected: "BULLISH_TREND")`);
    console.log(`- indicatorSnapshot: ${JSON.stringify(dbTrade.indicatorSnapshot)}`);
    console.log(`- status: ${dbTrade.status} (Expected: "TP HIT")`);
    console.log(`- pnl: $${dbTrade.pnl} (Expected: positive value)`);
    console.log(`- roi: ${dbTrade.roi}% (Expected: positive value)`);

    if (dbTrade.strategyId !== "ema-cross-adx") throw new Error("Incorrect strategyId in Trade");
    if (dbTrade.strategyName !== "EMA Cross ADX") throw new Error("Incorrect strategyName in Trade");
    if (dbTrade.strategyCategory !== "Trend Following") throw new Error("Incorrect strategyCategory in Trade");
    if (!dbTrade.entryReason?.includes("EMA 12 crossed")) throw new Error("Incorrect entryReason in Trade");
    if (!dbTrade.exitReason?.includes("Take Profit reached")) throw new Error("Incorrect exitReason in Trade");
    if (dbTrade.confidenceAtEntry !== 0.85) throw new Error("Incorrect confidenceAtEntry in Trade");
    if (dbTrade.confidence !== 0.85) throw new Error("Incorrect confidence in Trade");
    if (dbTrade.marketRegime !== "BULLISH_TREND") throw new Error("Incorrect marketRegime in Trade");
    if (!dbTrade.indicatorSnapshot) throw new Error("Missing indicatorSnapshot in Trade");
    if (dbTrade.status !== "TP HIT") throw new Error("Incorrect status in Trade");

    console.log("[TEST] ✅ Trade fields verified successfully.");

    // 9. Clean up
    console.log("\n[TEST] Cleaning up test database records...");
    await prisma.trade.deleteMany({ where: { userId } });
    await prisma.position.deleteMany({ where: { userId } });
    await prisma.userSettings.deleteMany({ where: { userId } });
    await prisma.wallet.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });

    console.log("\n=== ALL TRADE AUDIT PIPELINE TESTS PASSED SUCCESSFULLY! ===\n");
  } catch (error) {
    console.error("\n[TEST] Trade audit verification failed with error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testTradeAuditPipeline();
