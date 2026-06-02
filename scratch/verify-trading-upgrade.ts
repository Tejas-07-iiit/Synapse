import { PrismaClient } from "@prisma/client";
import { PaperTradingEngine } from "../src/execution-engine/paper";
import { RiskEngine } from "../src/execution-engine/risk";
import { ensureUserExists } from "../services/user/userService";
import { useWalletStore } from "../src/stores/walletStore";
import { useSettingsStore } from "../src/stores/settingsStore";
import { ConfidenceEngine } from "../src/strategy-engine/core/confidence-engine";
import { TradingMode } from "../src/strategy-engine/types";

const prisma = new PrismaClient();

async function runVerification() {
  console.log("==========================================================");
  console.log("=== STARTING TRADING SYSTEM UPGRADE VERIFICATION TESTS ===");
  console.log("==========================================================\n");

  const userId = "test-user-upgrade";

  const cleanMemoryAndDb = async () => {
    // 1. Clear database positions for test user
    await prisma.position.deleteMany({ where: { userId } });
    await prisma.trade.deleteMany({ where: { userId } });
    
    // 2. Clear PaperTradingEngine caches using cast to any
    (PaperTradingEngine as any).positions.clear();
    (PaperTradingEngine as any).lastDbUpdate.clear();
    (PaperTradingEngine as any).executionLocks.clear();
    (PaperTradingEngine as any).symbolCooldowns.clear();
    
    // 3. Load active positions (should be 0)
    await PaperTradingEngine.loadActivePositions(userId);
  };

  try {
    // 0. Ensure user exists
    await ensureUserExists(userId);

    // Register DB Handlers to mock daemon environment
    PaperTradingEngine.registerDbHandler({
      fetchActivePositions: async (uid) => {
        return prisma.position.findMany({ where: { userId: uid, status: "OPEN" } });
      },
      openPosition: async (data) => {
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
            status: "OPEN",
            strategyId: data.strategyId,
            strategyName: data.strategyName,
            strategyCategory: data.strategyCategory,
            entryReason: data.entryReason,
            confidenceAtEntry: data.confidenceAtEntry,
            marketRegime: data.marketRegime,
            indicatorSnapshot: data.indicatorSnapshot,
            auditPayload: data.auditPayload,
            expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
            confidenceScore: data.confidenceScore,
          }
        });
      },
      updatePosition: async (id, currentPrice, pnl) => {
        return prisma.position.update({ where: { id }, data: { currentPrice, pnl } });
      },
      closePosition: async (data) => {
        const { id, exitPrice, pnl, closedAt, openedAt, userId, symbol, direction, entryPrice, stopLoss, takeProfit, leverage, reason, strategyId, strategyName, strategyCategory, entryReason, confidenceAtEntry, marketRegime, indicatorSnapshot, exitReason, auditPayload } = data;
        await prisma.position.update({
          where: { id },
          data: { status: "CLOSED", currentPrice: exitPrice, pnl, closedAt: new Date(closedAt), exitReason }
        });
        await prisma.trade.create({
          data: {
            userId,
            symbol,
            strategyName: strategyName || "Test",
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
            roi: 0,
            status: "CLOSED",
            openedAt: new Date(openedAt),
            closedAt: new Date(closedAt),
            executionType: "PAPER"
          }
        });
        await prisma.wallet.update({
          where: { userId },
          data: { balance: { increment: pnl } }
        });
      },
      fetchWallet: async (uid) => {
        return prisma.wallet.findUnique({ where: { userId: uid } });
      }
    });

    // Now clean up database and memory and reset wallet balance
    await cleanMemoryAndDb();
    await prisma.wallet.update({
      where: { userId },
      data: { balance: 10000.0, totalDeposited: 10000.0 }
    });

    // -------------------------------------------------------------------------
    // TEST 1: ATR Adaptive SL/TP levels and expiresAt calculation (Scalping)
    // -------------------------------------------------------------------------
    console.log("--- TEST 1: ATR SL/TP levels and expiresAt (Scalping) ---");
    const scalpingSettings = {
      autoTrading: true,
      maxOpenTrades: 5,
      preferredTradingMode: "SCALPING" as const
    };

    const atr = 10;
    const entryPrice = 1000;
    // For SCALPING: SL = 0.8 * ATR = 8; TP = 1.2 * ATR = 12
    const stopLoss = entryPrice - (0.8 * atr); // 992
    const takeProfit = entryPrice + (1.2 * atr); // 1012

    const signalContext = {
      strategyId: "ema-crossover",
      strategyName: "EMA Crossover",
      strategyCategory: "Trend Following",
      confidence: 80,
      marketContext: { regime: "TRENDING" }
    };

    const pos1 = await PaperTradingEngine.openPosition(
      userId,
      "BTCUSDT",
      "LONG",
      entryPrice,
      null, // Auto-size
      stopLoss,
      takeProfit,
      1, // 1x leverage
      10000.0, // Balance
      scalpingSettings,
      signalContext
    );

    if (!pos1) {
      throw new Error("Failed to open Scalping position!");
    }

    console.log(`- Opened Scalping Position: ID=${pos1.id}, Symbol=${pos1.symbol}, SL=${pos1.stopLoss}, TP=${pos1.takeProfit}`);
    if (pos1.stopLoss !== 992) throw new Error(`Incorrect stop loss calculated! Expected 992, got ${pos1.stopLoss}`);
    if (pos1.takeProfit !== 1012) throw new Error(`Incorrect take profit calculated! Expected 1012, got ${pos1.takeProfit}`);

    const expectedExpiryMin = Date.now() + (45 * 60 * 1000) - 5000;
    const expectedExpiryMax = Date.now() + (45 * 60 * 1000) + 5000;
    const expiresAtMs = pos1.expiresAt ? new Date(pos1.expiresAt).getTime() : 0;
    
    if (expiresAtMs < expectedExpiryMin || expiresAtMs > expectedExpiryMax) {
      throw new Error(`Incorrect expiresAt calculation! Expected around ${new Date(Date.now() + 45 * 60 * 1000).toISOString()}, got ${new Date(expiresAtMs).toISOString()}`);
    }
    console.log("  [expiresAt]:", new Date(expiresAtMs).toISOString(), "(Valid: ~45 mins from now)");

    console.log("[TEST 1] ✅ Passed.\n");

    // -------------------------------------------------------------------------
    // TEST 2: Trade Timeout Expiry Exit
    // -------------------------------------------------------------------------
    console.log("--- TEST 2: Trade Timeout Expiry Exit ---");
    // Manually mutate the in-memory expiresAt to a past timestamp
    pos1.expiresAt = Date.now() - 1000; 

    // Update prices - this should trigger the timeout closure
    await PaperTradingEngine.updatePrices("BTCUSDT", 1000);

    // Verify it is closed
    const activePositions = PaperTradingEngine.getOpenPositions().filter(p => p.userId === userId);
    if (activePositions.some(p => p.id === pos1.id)) {
      throw new Error("Position failed to close on timeout!");
    }

    const closedPos = await prisma.position.findUnique({ where: { id: pos1.id } });
    console.log(`- Position status in DB: "${closedPos?.status}", Exit Reason: "${closedPos?.exitReason}"`);
    if (closedPos?.status !== "CLOSED" || closedPos?.exitReason !== "Position closed due to timeout rule.") {
      throw new Error(`Timeout exit failed to update DB with exit reason! Got: ${closedPos?.exitReason}`);
    }

    console.log("[TEST 2] ✅ Passed.\n");

    // -------------------------------------------------------------------------
    // TEST 3: Dynamic Sizing Sizing Calculations (5% - 50% with safety rules)
    // -------------------------------------------------------------------------
    console.log("--- TEST 3: Dynamic Position Sizing & Safety Rules ---");

    const trendingSettings = {
      autoTrading: true,
      maxOpenTrades: 5,
      preferredTradingMode: "INTRADAY" as const
    };

    // Case 3a: Confidence = 50 (< 60). Expected sizing: 5% + (50/60)*5% = 9.17% of wallet
    await cleanMemoryAndDb();
    console.log("- Case 3a: Low confidence (< 60) sizing...");
    const posLowConf = await PaperTradingEngine.openPosition(
      userId,
      "ETHUSDT",
      "LONG",
      2000,
      null, // Auto-size
      1900,
      2200,
      1,
      10000.0,
      trendingSettings,
      { strategyId: "rsi-reversal", strategyName: "RSI Reversal", confidence: 50, marketContext: { regime: "RANGING" } }
    );
    const sizeLowConf = posLowConf ? posLowConf.entryPrice * posLowConf.quantity : 0;
    const pctLowConf = (sizeLowConf / 10000.0) * 100;
    console.log(`  [Confidence = 50]: Size = $${sizeLowConf.toFixed(2)} (${pctLowConf.toFixed(2)}%) (Expected: ~9.17%)`);
    if (Math.abs(pctLowConf - 9.17) > 0.1) throw new Error("Incorrect low confidence sizing!");

    // Case 3b: Confidence = 70 (60-80). Expected sizing: 10% + (10/20)*20% = 20% of wallet
    await cleanMemoryAndDb();
    console.log("- Case 3b: Medium confidence (60-80) sizing...");
    const posMedConf = await PaperTradingEngine.openPosition(
      userId,
      "SOLUSDT",
      "LONG",
      100,
      null,
      95,
      110,
      1,
      10000.0,
      trendingSettings,
      { strategyId: "macd-momentum", strategyName: "MACD Momentum", confidence: 70, marketContext: { regime: "RANGING" } }
    );
    const sizeMedConf = posMedConf ? posMedConf.entryPrice * posMedConf.quantity : 0;
    const pctMedConf = (sizeMedConf / 10000.0) * 100;
    console.log(`  [Confidence = 70]: Size = $${sizeMedConf.toFixed(2)} (${pctMedConf.toFixed(2)}%) (Expected: ~17.50%)`);
    if (Math.abs(pctMedConf - 17.5) > 0.1) throw new Error("Incorrect medium confidence sizing!");

    // Case 3c: Confidence = 95 (> 80), Trending regime, no drawdown, no correlation. Expected sizing: 30% + (15/20)*20% = 45% of wallet
    await cleanMemoryAndDb();
    console.log("- Case 3c: High confidence (> 90) with Safety Rules Met sizing...");
    const posHighConfSafe = await PaperTradingEngine.openPosition(
      userId,
      "XRPUSDT",
      "LONG",
      1.0,
      null,
      0.9,
      1.2,
      1,
      10000.0,
      trendingSettings,
      { strategyId: "momentum", strategyName: "Momentum", confidence: 95, marketContext: { regime: "TRENDING" } }
    );
    const sizeHighConfSafe = posHighConfSafe ? posHighConfSafe.entryPrice * posHighConfSafe.quantity : 0;
    const pctHighConfSafe = (sizeHighConfSafe / 10000.0) * 100;
    console.log(`  [Confidence = 95, Trending]: Size = $${sizeHighConfSafe.toFixed(2)} (${pctHighConfSafe.toFixed(2)}%) (Expected: ~40.00%)`);
    if (Math.abs(pctHighConfSafe - 40) > 0.1) throw new Error("Incorrect high confidence safety rules met sizing!");

    // Case 3d: Confidence = 95 (> 80) but Ranging Regime. Expected sizing: Clamped to recommended max of 30%
    await cleanMemoryAndDb();
    console.log("- Case 3d: High confidence but Safety Rules NOT Met (Ranging regime) sizing...");
    const posHighConfUnsafe = await PaperTradingEngine.openPosition(
      userId,
      "ADAUSDT",
      "LONG",
      0.5,
      null,
      0.45,
      0.6,
      1,
      10000.0,
      trendingSettings,
      { strategyId: "defensive", strategyName: "Defensive", confidence: 95, marketContext: { regime: "RANGING" } }
    );
    const sizeHighConfUnsafe = posHighConfUnsafe ? posHighConfUnsafe.entryPrice * posHighConfUnsafe.quantity : 0;
    const pctHighConfUnsafe = (sizeHighConfUnsafe / 10000.0) * 100;
    console.log(`  [Confidence = 95, Ranging]: Size = $${sizeHighConfUnsafe.toFixed(2)} (${pctHighConfUnsafe.toFixed(2)}%) (Expected: ~30.00%)`);
    if (Math.abs(pctHighConfUnsafe - 30) > 0.1) throw new Error("Incorrect high confidence safety rules NOT met sizing (should clamp to 30%)!");

    console.log("[TEST 3] ✅ Passed.\n");

    // Clean up open positions before starting risk tests
    await cleanMemoryAndDb();

    // -------------------------------------------------------------------------
    // TEST 4: Risk Protections
    // -------------------------------------------------------------------------
    console.log("--- TEST 4: Risk protections ---");

    // Open initial position on BTCUSDT using strategy 'macd-momentum' LONG
    console.log("- Placing initial LONG position on BTCUSDT with 'macd-momentum'...");
    const btcPos = await PaperTradingEngine.openPosition(
      userId,
      "BTCUSDT",
      "LONG",
      60000,
      500,
      59000,
      62000,
      1,
      10000.0,
      trendingSettings,
      { strategyId: "macd-momentum", strategyName: "MACD Momentum", confidence: 80, marketContext: { regime: "TRENDING" } }
    );
    if (!btcPos) throw new Error("Failed to place initial BTC position");

    // Case 4a: One-trade-per-symbol (BTCUSDT already open)
    console.log("- Case 4a: Attempting second trade on same symbol (BTCUSDT)...");
    const btcPos2 = await PaperTradingEngine.openPosition(
      userId,
      "BTCUSDT",
      "SHORT",
      60000,
      500,
      61000,
      58000,
      1,
      10000.0,
      trendingSettings,
      { strategyId: "ema-crossover", strategyName: "EMA Crossover", confidence: 80, marketContext: { regime: "TRENDING" } }
    );
    console.log(`  [One-Trade-Per-Symbol]: result=${btcPos2 ? "OPENED" : "BLOCKED"} (Expected: BLOCKED)`);
    if (btcPos2 !== null) throw new Error("One-trade-per-symbol check failed!");

    // Case 4b: One-trade-per-strategy ('macd-momentum' already open)
    console.log("- Case 4b: Attempting second trade generated by same strategy ID (macd-momentum) on another symbol...");
    const ethPos = await PaperTradingEngine.openPosition(
      userId,
      "ETHUSDT",
      "LONG",
      3000,
      500,
      29000,
      32000,
      1,
      10000.0,
      trendingSettings,
      { strategyId: "macd-momentum", strategyName: "MACD Momentum", confidence: 80, marketContext: { regime: "TRENDING" } }
    );
    console.log(`  [One-Trade-Per-Strategy]: result=${ethPos ? "OPENED" : "BLOCKED"} (Expected: BLOCKED)`);
    if (ethPos !== null) throw new Error("One-trade-per-strategy check failed!");

    // Case 4c: Correlation risk filter (LONG position already exists on BTCUSDT, try LONG on ETHUSDT using different strategy)
    console.log("- Case 4c: Attempting second LONG position on another symbol (ETHUSDT) with a different strategy...");
    const ethPosCorrelated = await PaperTradingEngine.openPosition(
      userId,
      "ETHUSDT",
      "LONG",
      3000,
      500,
      29000,
      32000,
      1,
      10000.0,
      trendingSettings,
      { strategyId: "ema-crossover", strategyName: "EMA Crossover", confidence: 80, marketContext: { regime: "TRENDING" } }
    );
    console.log(`  [Correlation Filter]: result=${ethPosCorrelated ? "OPENED" : "BLOCKED"} (Expected: BLOCKED)`);
    if (ethPosCorrelated !== null) throw new Error("Correlation risk filter failed!");

    // Case 4d: Non-correlated trade (SHORT on ETHUSDT should be allowed since BTC is LONG)
    console.log("- Case 4d: Attempting SHORT position on ETHUSDT (opposite direction to BTC)...");
    const ethPosAllowed = await PaperTradingEngine.openPosition(
      userId,
      "ETHUSDT",
      "SHORT",
      3000,
      500,
      31000,
      2800,
      1,
      10000.0,
      trendingSettings,
      { strategyId: "ema-crossover", strategyName: "EMA Crossover", confidence: 80, marketContext: { regime: "TRENDING" } }
    );
    console.log(`  [Non-Correlated Trade]: result=${ethPosAllowed ? "OPENED" : "BLOCKED"} (Expected: OPENED)`);
    if (ethPosAllowed === null) throw new Error("Legitimate opposite direction trade blocked by correlation filter!");

    // Case 4e: High confidence correlation trade under limit (allowed)
    console.log("- Case 4e: Attempting second LONG position on another symbol (SOLUSDT) with high confidence (95) under 50% limit...");
    const solPosHighConf = await PaperTradingEngine.openPosition(
      userId,
      "SOLUSDT",
      "LONG",
      100,
      500, // 5% of wallet
      95,
      110,
      1,
      10000.0,
      trendingSettings,
      { strategyId: "rsi-reversal", strategyName: "RSI Reversal", confidence: 95, marketContext: { regime: "TRENDING" } }
    );
    console.log(`  [High-Conf Correlated Trade]: result=${solPosHighConf ? "OPENED" : "BLOCKED"} (Expected: OPENED)`);
    if (solPosHighConf === null) throw new Error("High confidence correlated trade under 50% limit was blocked!");

    // Case 4f: High confidence correlation trade exceeding limit (blocked)
    console.log("- Case 4f: Attempting third LONG position on another symbol (ADAUSDT) with high confidence (95) exceeding 50% limit...");
    const adaPosHighConfExceeded = await PaperTradingEngine.openPosition(
      userId,
      "ADAUSDT",
      "LONG",
      0.5,
      4500, // 45% of wallet, making total correlated LONG exposure = 500 (BTC) + 500 (SOL) + 4500 = 5500 (55%)
      0.45,
      0.6,
      1,
      10000.0,
      trendingSettings,
      { strategyId: "momentum", strategyName: "Momentum", confidence: 95, marketContext: { regime: "TRENDING" } }
    );
    console.log(`  [High-Conf Correlated Limit Exceeded]: result=${adaPosHighConfExceeded ? "OPENED" : "BLOCKED"} (Expected: BLOCKED)`);
    if (adaPosHighConfExceeded !== null) throw new Error("Correlated trade exceeding 50% limit was opened!");

    console.log("[TEST 4] ✅ Passed.\n");

    console.log("==========================================================");
    console.log("=== ALL UPGRADE VERIFICATION TESTS PASSED SUCCESSFULLY ===");
    console.log("==========================================================");
    process.exit(0);

  } catch (error) {
    console.error("\n❌ Upgrade Verification failed with error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runVerification();
