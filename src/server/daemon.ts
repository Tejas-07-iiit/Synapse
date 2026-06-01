import { PrismaClient } from "@prisma/client";
import { marketEngine } from "../market-engine/market-engine";
import { PaperTradingEngine } from "../execution-engine/paper";
import { strategyEngine } from "../strategy-engine/core/engine";
import { marketWsService } from "../market-engine/websocket";
import { useMarketStore } from "../stores/marketStore";
import { PerformanceWeightingEngine } from "../strategy-engine/core/performance-weighting";
import { AuditLogger } from "../lib/audit/trading-audit";

const prisma = new PrismaClient();

async function runDaemon() {
  console.log("==================================================");
  console.log("[Daemon] Starting Synapse Server-Side Engine Daemon");
  console.log("==================================================");

  // 1. REGISTER DIRECT DATABASE HANDLER FOR PAPER TRADING ENGINE
  PaperTradingEngine.registerDbHandler({
    fetchActivePositions: async (userId: string) => {
      return prisma.position.findMany({
        where: { userId, status: "OPEN" },
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
        userId,
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

      // Update position to CLOSED
      await prisma.position.update({
        where: { id },
        data: {
          status: "CLOSED",
          currentPrice: exitPrice,
          pnl,
          closedAt: new Date(closedAt),
        },
      });

      // Map reason to status
      let tradeStatus = "CLOSED";
      if (reason === "STOP_LOSS" || reason === "STOPPED" || reason === "SL HIT") {
        tradeStatus = "STOPPED";
      } else if (reason === "TAKE_PROFIT" || reason === "TP HIT") {
        tradeStatus = "TP HIT";
      }

      // Calculate ROI
      const isLong = direction === "LONG";
      const priceDiff = isLong ? exitPrice - entryPrice : entryPrice - exitPrice;
      const roi = (priceDiff / entryPrice) * 100 * leverage;

      // Create Trade History log
      try {
        await prisma.trade.create({
          data: {
            userId,
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
        
        AuditLogger.logTradeClosed({ userId, symbol, entry: entryPrice, exit: exitPrice, pnl, reason, strategyName });
        if (tradeStatus === "TP HIT") {
          AuditLogger.logTakeProfitHit({ userId, symbol, entry: entryPrice, exit: exitPrice, profit: pnl, roi, strategyName });
        } else if (tradeStatus === "STOPPED") {
          AuditLogger.logStopLossHit({ userId, symbol, entry: entryPrice, exit: exitPrice, loss: pnl, roi, strategyName });
        }
      } catch (err) {
        AuditLogger.logDatabaseError({ action: "createTrade", message: "Failed to log trade history", errorDetails: err });
      }

      // Update Wallet realized balance
      await prisma.wallet.update({
        where: { userId },
        data: {
          balance: { increment: pnl },
          realizedPnl: { increment: pnl },
        },
      });

      // Recalculate strategy weights in background
      PerformanceWeightingEngine.updatePerformanceScores().catch(() => {});
    },
    fetchWallet: async (userId: string) => {
      return prisma.wallet.findUnique({
        where: { userId },
      });
    },
  });

  // 2. REGISTER DIRECT DATABASE HANDLER FOR STRATEGY ENGINE
  strategyEngine.registerDbHandler({
    logStrategyRun: async (data: any) => {
      const { strategyId, symbol, timeframe, result, durationMs } = data;
      await prisma.strategyExecution.create({
        data: {
          strategyId,
          symbol,
          timeframe,
          signalResult: result,
          durationMs,
          success: true,
        },
      });
      await prisma.strategyResult.create({
        data: {
          strategyId,
          symbol,
          timeframe,
          signalResult: result,
          durationMs,
          success: true,
        },
      });
    },
    logSignals: async (signals: any[]) => {
      for (const sig of signals) {
        await prisma.tradeSignal.create({
          data: {
            symbol: sig.symbol,
            timeframe: sig.timeframe,
            strategyId: sig.strategyId,
            direction: sig.signal,
            confidence: sig.confidence,
            entry: sig.entry,
            stopLoss: sig.stopLoss,
            takeProfit: sig.takeProfit,
            timestamp: new Date(sig.timestamp),
            reasoning: sig.reasoning,
          },
        });

        await prisma.strategy.upsert({
          where: { id: sig.strategyId },
          update: {},
          create: {
            id: sig.strategyId,
            name: sig.strategyName || "AI Strategy",
            description: "Auto-registered strategy profile.",
            enabled: true,
          },
        });

        await prisma.signal.create({
          data: {
            strategyId: sig.strategyId,
            symbol: sig.symbol,
            timeframe: sig.timeframe,
            signalType: sig.signal,
            confidence: sig.confidence,
            entry: sig.entry,
            stopLoss: sig.stopLoss,
            takeProfit: sig.takeProfit,
            reasoning: sig.reasoning,
            indicators: {
              ...(sig.indicators || {}),
              marketContext: sig.marketContext || {},
            },
            timestamp: new Date(sig.timestamp),
          },
        });

        await prisma.signalLog.create({
          data: {
            symbol: sig.symbol,
            timeframe: sig.timeframe,
            strategyId: sig.strategyId,
            direction: sig.signal,
            confidence: sig.confidence,
            reasoning: sig.reasoning,
            indicators: {
              ...(sig.indicators || {}),
              marketContext: sig.marketContext || {},
            },
            timestamp: new Date(sig.timestamp),
          },
        });
      }
    },
    logIndicatorSnapshot: async (data: any) => {
      const { symbol, timeframe, timestamp, indicators } = data;
      const idx = indicators.rsi.length - 1;
      if (idx >= 0) {
        await prisma.indicatorSnapshot.create({
          data: {
            symbol,
            timeframe,
            timestamp: new Date(timestamp),
            rsi: indicators.rsi[idx],
            ema12: indicators.ema12[idx],
            ema26: indicators.ema26[idx],
            ema20: indicators.ema20[idx],
            sma50: indicators.sma50[idx],
            macdLine: indicators.macdLine[idx],
            signalLine: indicators.signalLine[idx],
            macdHist: indicators.macdHist[idx],
            bbUpper: indicators.bbUpper[idx],
            bbMiddle: indicators.bbMiddle[idx],
            bbLower: indicators.bbLower[idx],
            atr: indicators.atr[idx],
            vwap: indicators.vwap[idx],
            volume: indicators.volumeMA[idx],
          },
        });
      }
    },
  });

  // 3. MULTI-USER AUTONOMOUS ORDER EXECUTION SYSTEM
  strategyEngine.registerCallback(async (symbol, timeframe, regime, signals, indicators) => {
    const sym = symbol.toUpperCase();
    const tf = timeframe.toLowerCase();

    for (const sig of signals) {
      if (sig.signal !== "LONG" && sig.signal !== "SHORT") {
        continue;
      }

      AuditLogger.logSignalGenerated({
        strategyId: sig.strategyId,
        strategyName: sig.strategyName || "Unknown Strategy",
        symbol: sym,
        timeframe: tf,
        confidence: sig.confidence,
        direction: sig.signal,
        regime: regime
      });

      // Query database for all users that have autoTrading enabled
      const usersWithAuto = await prisma.userSettings.findMany({
        where: { autoTrading: true },
        include: { user: true },
      });

      for (const settings of usersWithAuto) {
        const userId = settings.userId;

        // Load wallet balance
        const wallet = await prisma.wallet.findUnique({ where: { userId } });
        if (!wallet) {
          continue;
        }

        // Check position limits
        const existingOpen = PaperTradingEngine.getOpenPositions().find(
          (p) => p.symbol === sym && p.status === "OPEN" && p.userId === userId
        );

        if (existingOpen) {
          AuditLogger.logSignalRejected({ strategyId: sig.strategyId, symbol: sym, reason: `Active position already exists for user ${userId}` });
          continue;
        }

        // A. Check quarantine status
        if (PerformanceWeightingEngine.isQuarantined(sig.strategyId)) {
          AuditLogger.logQuarantineBlocked({ userId, symbol: sym, strategyId: sig.strategyId });
          continue;
        }

        // B. Check symbol cooldowns
        const lastTrade = await prisma.trade.findFirst({
          where: {
            userId,
            symbol: sym,
            executionType: "PAPER",
          },
          orderBy: {
            closedAt: "desc",
          },
        });

        if (lastTrade) {
          const timeSinceCloseMs = Date.now() - new Date(lastTrade.closedAt).getTime();
          let cooldownMinutes = 0;
          if (lastTrade.status === "STOPPED") {
            cooldownMinutes = 30;
          } else if (lastTrade.status === "TP HIT") {
            cooldownMinutes = 5;
          } else { // "CLOSED"
            cooldownMinutes = 10;
          }

          const cooldownMs = cooldownMinutes * 60 * 1000;
          if (timeSinceCloseMs < cooldownMs) {
            const remainingMins = Math.ceil((cooldownMs - timeSinceCloseMs) / (60 * 1000));
            AuditLogger.logCooldownBlocked({ userId, symbol: sym, remainingMinutes: remainingMins, lastStatus: lastTrade.status });
            continue;
          }
        }

        // C. Set strategy-specific ATR-based Stop Loss & Take Profit boundaries
        const direction: "LONG" | "SHORT" = sig.signal;
        
        // Retrieve real-time ATR value for the current symbol
        const lastIdx = indicators.atr ? indicators.atr.length - 1 : -1;
        const atrVal = (lastIdx >= 0 && indicators.atr[lastIdx]) ? indicators.atr[lastIdx] : (sig.entry * 0.015);

        const category = sig.strategyCategory || "Central Engine";
        const isTrendingStrat = category === "Trend Following" || category === "Sentiment" || category === "Defensive";
        const isMeanReversionStrat = category === "Reversal" || category === "Mean-Reversion" || category === "MeanReversion" || category === "Grid";
        const isBreakoutStrat = category === "Breakout" || category === "Volatility";

        let slMult = 2.0;
        let tpMult = 4.0;
        if (isTrendingStrat) {
          slMult = 2.5;
          tpMult = 5.0;
        } else if (isBreakoutStrat) {
          slMult = 2.0;
          tpMult = 4.0;
        } else if (isMeanReversionStrat) {
          slMult = 1.5;
          tpMult = 3.0;
        }

        const atrSlDist = slMult * atrVal;
        const atrTpDist = tpMult * atrVal;

        const atrSl = direction === "LONG" ? sig.entry - atrSlDist : sig.entry + atrSlDist;
        const atrTp = direction === "LONG" ? sig.entry + atrTpDist : sig.entry - atrTpDist;

        // Fallbacks if ATR SL/TP is not computed properly or is invalid
        const finalSl = atrSl > 0 ? atrSl : (direction === "LONG" ? sig.entry * 0.95 : sig.entry * 1.05);
        const finalTp = atrTp > 0 ? atrTp : (direction === "LONG" ? sig.entry * 1.10 : sig.entry * 0.90);

        try {
          const position = await PaperTradingEngine.openPosition(
            userId,
            sym,
            direction,
            sig.entry,
            null, // Auto-size based on risk settings and wallet balance
            finalSl,
            finalTp,
            1, // 1x leverage
            wallet.balance, // explicitBalance
            {
              autoTrading: settings.autoTrading,
              maxOpenTrades: settings.maxOpenTrades,
              riskPerTradePct: settings.riskPerTradePct,
            }, // explicitSettings
            sig // Pass signal context
          );

          if (position) {
            AuditLogger.logTradeExecuted({
              userId,
              symbol: sym,
              direction,
              entry: sig.entry,
              sl: finalSl,
              tp: finalTp,
              quantity: position.quantity,
              strategyName: sig.strategyName || "Unknown Strategy",
              confidence: sig.confidence
            });
          }
        } catch (err) {
          AuditLogger.logSystemError({ module: "Daemon", message: `Autonomous trade placement failed for user ${userId}`, errorDetails: err });
        }
      }
    }
  });

  // 4. LOAD ACTIVE POSITIONS FOR ALL USERS
  const allUsers = await prisma.user.findMany();
  console.log(`[Daemon] Syncing active positions for ${allUsers.length} users...`);
  for (const u of allUsers) {
    await PaperTradingEngine.loadActivePositions(u.id);
  }
  console.log(`[Daemon] Sync complete. In-memory active positions: ${PaperTradingEngine.getOpenPositions().length}`);
 
  // Initialize Strategy Performance Weights from DB trade history
  await PerformanceWeightingEngine.updatePerformanceScores();

  // 5. BOOT ENGINE LOOP
  const coinsList = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
  useMarketStore.setState({
    supportedSymbols: coinsList,
  });

  console.log("[Daemon] Initializing market engine...");
  // Initialize on 15m timeframe for BTC (which triggers full stream subscriptions for all supported symbols)
  await marketEngine.init("BTCUSDT", "15m");

  // Subscribe to ticker feeds as they are required to trigger PaperTradingEngine price tick checks
  const tickerStreams = coinsList.map((c) => `${c.toLowerCase()}@ticker`);
  marketWsService.subscribe(tickerStreams);

  console.log("[Daemon] Market streams & ticker execution actively running 24/7.");

  setInterval(async () => {
    try {
      const activeUsersCount = await prisma.userSettings.count({ where: { autoTrading: true } });
      AuditLogger.logDaemonHeartbeat({
        status: "Daemon Running",
        wsConnected: useMarketStore.getState().wsConnected,
        activeUsers: activeUsersCount,
        openPositions: PaperTradingEngine.getOpenPositions().length,
        trackedSymbols: useMarketStore.getState().supportedSymbols,
      });
    } catch (err) {
      AuditLogger.logDatabaseError({ action: "Heartbeat", message: "Failed to fetch active users count", errorDetails: err });
    }
  }, 60000);
}

runDaemon().catch((err) => {
  console.error("[Daemon] Fatal Daemon Crash:", err);
  process.exit(1);
});
