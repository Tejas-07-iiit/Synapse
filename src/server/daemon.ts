import { PrismaClient } from "@prisma/client";
import { marketEngine } from "../market-engine/market-engine";
import { PaperTradingEngine } from "../execution-engine/paper";
import { strategyEngine } from "../strategy-engine/core/engine";
import { marketWsService } from "../market-engine/websocket";
import { useSettingsStore } from "../stores/settingsStore";
import { useWalletStore } from "../stores/walletStore";
import { useMarketStore } from "../stores/marketStore";

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
      if (reason === "STOP_LOSS" || reason === "STOPPED") {
        tradeStatus = "STOPPED";
      } else if (reason === "TAKE_PROFIT" || reason === "TP HIT") {
        tradeStatus = "TP HIT";
      }

      // Calculate ROI
      const isLong = direction === "LONG";
      const priceDiff = isLong ? exitPrice - entryPrice : entryPrice - exitPrice;
      const roi = (priceDiff / entryPrice) * 100 * leverage;

      // Create Trade History log
      await prisma.trade.create({
        data: {
          userId,
          symbol,
          strategyName: "Central Engine",
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
          confidence: 0.8,
          status: tradeStatus,
          openedAt: new Date(openedAt),
          closedAt: new Date(closedAt),
          executionType: "PAPER",
        },
      });

      // Update Wallet realized balance
      await prisma.wallet.update({
        where: { userId },
        data: {
          balance: { increment: pnl },
          realizedPnl: { increment: pnl },
        },
      });
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

      console.log(`[Daemon] 🔔 Signal generated: ${sig.strategyName} ${sig.signal} ${sym} (${tf}) @ $${sig.entry}`);

      // Query database for all users that have autoTrading enabled
      const usersWithAuto = await prisma.userSettings.findMany({
        where: { autoTrading: true },
        include: { user: true },
      });

      console.log(`[Daemon] Found ${usersWithAuto.length} active users with autonomous trading enabled.`);

      for (const settings of usersWithAuto) {
        const userId = settings.userId;

        // Load wallet balance
        const wallet = await prisma.wallet.findUnique({ where: { userId } });
        if (!wallet) {
          console.warn(`[Daemon] Wallet not found for user ${userId}. Skipping.`);
          continue;
        }

        // Check position limits
        const existingOpen = PaperTradingEngine.getOpenPositions().find(
          (p) => p.symbol === sym && p.status === "OPEN" && p.userId === userId
        );

        if (existingOpen) {
          console.log(`[Daemon] Signal ignored for user ${userId}: active position already exists for ${sym}`);
          continue;
        }

        // Inject this specific user settings/wallet into in-memory Zustand store states
        // so PaperTradingEngine calculates quantity and runs risk validations under their context
        useWalletStore.setState({
          balance: wallet.balance,
          totalDeposited: wallet.totalDeposited,
          totalWithdrawn: wallet.totalWithdrawn,
          realizedPnl: wallet.realizedPnl,
        });

        useSettingsStore.setState({
          autoTrading: settings.autoTrading,
          riskPerTradePct: settings.riskPerTradePct,
          maxOpenTrades: settings.maxOpenTrades,
          defaultSlPct: settings.defaultSlPct,
          defaultTpPct: settings.defaultTpPct,
          prefTimeframe: settings.prefTimeframe,
          prefSymbol: settings.prefSymbol,
        });

        // Set SL / TP boundaries
        const direction: "LONG" | "SHORT" = sig.signal;
        const defaultSl =
          direction === "LONG"
            ? sig.entry * (1 - settings.defaultSlPct / 100)
            : sig.entry * (1 + settings.defaultSlPct / 100);

        const defaultTp =
          direction === "LONG"
            ? sig.entry * (1 + settings.defaultTpPct / 100)
            : sig.entry * (1 - settings.defaultTpPct / 100);

        try {
          console.log(`[Daemon] 🚀 Placing autonomous order: ${direction} ${sym} for User: ${settings.user.username}`);
          const position = await PaperTradingEngine.openPosition(
            userId,
            sym,
            direction,
            sig.entry,
            null, // Auto-size based on risk settings and wallet balance
            sig.stopLoss || defaultSl,
            sig.takeProfit || defaultTp,
            1 // 1x leverage
          );

          if (position) {
            console.log(`[Daemon] ✅ Autonomous trade created. Position ID: ${position.id}`);
          }
        } catch (err) {
          console.error(`[Daemon] ❌ Autonomous trade placement failed for user ${userId}:`, err);
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
}

runDaemon().catch((err) => {
  console.error("[Daemon] Fatal Daemon Crash:", err);
  process.exit(1);
});
