import { PrismaClient } from "@prisma/client";
import { marketEngine } from "../market-engine/market-engine";
import { PaperTradingEngine } from "../execution-engine/paper";
import { strategyEngine } from "../strategy-engine/core/engine";
import { marketWsService } from "../market-engine/websocket";
import { useMarketStore } from "../stores/marketStore";
import { PerformanceWeightingEngine } from "../strategy-engine/core/performance-weighting";
import { ConfidenceEngine } from "../strategy-engine/core/confidence-engine";
import { AuditLogger } from "../lib/audit/trading-audit";
import { strategyRegistry } from "../strategy-engine/core/registry";

process.on("unhandledRejection", (reason, promise) => {
  console.error("[Daemon] Unhandled Promise Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[Daemon] Uncaught Exception thrown:", error);
});

const prisma = new PrismaClient();

async function runDaemon() {
  console.log("==================================================");
  console.log("[Daemon] Starting Synapse Server-Side Engine Daemon");
  console.log("==================================================");

  // 1. REGISTER DIRECT DATABASE HANDLER FOR PAPER TRADING ENGINE
  PaperTradingEngine.registerDbHandler({
    fetchActivePositions: async (userId: string) => {
      try {
        return await prisma.position.findMany({
          where: { userId, status: "OPEN" },
        });
      } catch (err) {
        console.error("[Daemon] fetchActivePositions DB Error:", err);
        return [];
      }
    },
    openPosition: async (data: any) => {
      try {
        return await prisma.position.create({
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
            auditPayload: data.auditPayload || null,
            expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
            confidenceScore: data.confidenceScore || null,
          },
        });
      } catch (err) {
        console.error("[Daemon] openPosition DB Error:", err);
        return null;
      }
    },
    updatePosition: async (id: string, currentPrice: number, pnl: number) => {
      try {
        return await prisma.position.update({
          where: { id },
          data: { currentPrice, pnl },
        });
      } catch (err) {
        console.error("[Daemon] updatePosition DB Error:", err);
        return null;
      }
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
        auditPayload,
      } = data;

      try {
        await prisma.$transaction(async (tx) => {
          // Check if position is already closed in DB
          const existingPos = await tx.position.findUnique({
            where: { id },
          });

          if (!existingPos) {
            console.warn(`[Daemon] Position ${id} not found in DB for closure.`);
            return;
          }

          if (existingPos.status === "CLOSED") {
            console.log(`[Daemon] Position ${id} (${symbol}) is already CLOSED in DB. Skipping duplicate DB updates.`);
            return;
          }

          // Update position to CLOSED
          await tx.position.update({
            where: { id },
            data: {
              status: "CLOSED",
              currentPrice: exitPrice,
              pnl,
              closedAt: new Date(closedAt),
              exitReason: exitReason || reason,
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

          const finalQuantity = data.quantity || 0;
          const entryValue = entryPrice * finalQuantity;
          const exitValue = exitPrice * finalQuantity;
          const entryFee = entryValue * 0.001;
          const exitFee = exitValue * 0.001;
          const totalFees = entryFee + exitFee;
          const grossPnl = pnl;
          const netPnl = grossPnl - totalFees;

          let finalAuditPayload = auditPayload || null;
          if (finalAuditPayload && typeof finalAuditPayload === "object") {
            finalAuditPayload = JSON.parse(JSON.stringify(finalAuditPayload));
          } else {
            finalAuditPayload = {};
          }

          finalAuditPayload.exitOutcome = {
            exitPrice,
            exitReason: exitReason || reason,
            durationMs: new Date(closedAt).getTime() - new Date(openedAt).getTime(),
            closedAt: new Date(closedAt).getTime(),
          };

          finalAuditPayload.executionCosts = {
            entryFee,
            exitFee,
            totalFees,
            grossPnl,
            netPnl,
          };

          // Create Trade History log
          await tx.trade.create({
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
              quantity: finalQuantity,
              leverage,
              pnl,
              roi,
              status: tradeStatus,
              openedAt: new Date(openedAt),
              closedAt: new Date(closedAt),
              executionType: "PAPER",
              entryFee,
              exitFee,
              totalFees,
              grossPnl,
              netPnl,
              feeRate: 0.001,
              auditPayload: finalAuditPayload,
              expiresAt: existingPos?.expiresAt || null,
              confidenceScore: existingPos?.confidenceScore || null,
            },
          });

          // Update Wallet realized balance
          await tx.wallet.update({
            where: { userId },
            data: {
              balance: { increment: netPnl },
              realizedPnl: { increment: netPnl },
            },
          });

          AuditLogger.logTradeClosed({ userId, symbol, entry: entryPrice, exit: exitPrice, pnl, reason, strategyName });
          if (tradeStatus === "TP HIT") {
            AuditLogger.logTakeProfitHit({ userId, symbol, entry: entryPrice, exit: exitPrice, profit: pnl, roi, strategyName });
          } else if (tradeStatus === "STOPPED") {
            AuditLogger.logStopLossHit({ userId, symbol, entry: entryPrice, exit: exitPrice, loss: pnl, roi, strategyName });
          }
        });
      } catch (err) {
        AuditLogger.logDatabaseError({ action: "closePositionTransaction", message: "Failed to atomically close position, trade, and update wallet", errorDetails: err });
      }

      // Recalculate strategy weights in background
      PerformanceWeightingEngine.updatePerformanceScores().catch(() => {});
    },
    fetchWallet: async (userId: string) => {
      try {
        return await prisma.wallet.findUnique({
          where: { userId },
        });
      } catch (err) {
        console.error("[Daemon] fetchWallet DB Error:", err);
        return null;
      }
    },
  });

  // 2. REGISTER DIRECT DATABASE HANDLER FOR STRATEGY ENGINE
  strategyEngine.registerDbHandler({
    logStrategyRun: async (data: any) => {
      try {
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
      } catch (err) {
        console.error("[Daemon] logStrategyRun DB Error:", err);
      }
    },
    logSignals: async (signals: any[]) => {
      try {
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
      } catch (err) {
        console.error("[Daemon] logSignals DB Error:", err);
      }
    },
    logIndicatorSnapshot: async (data: any) => {
      try {
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
      } catch (err) {
        console.error("[Daemon] logIndicatorSnapshot DB Error:", err);
      }
    },
  });

  // 3. MULTI-USER AUTONOMOUS ORDER EXECUTION SYSTEM
  strategyEngine.registerCallback(async (symbol, timeframe, regime, signals, indicators, rawSignals) => {
    try {
      const sym = symbol.toUpperCase();
      const tf = timeframe.toLowerCase();

      // Query database for all users that have autoTrading enabled
      // We use a robust approach to handle potential Prisma Client desyncs
      let usersWithAuto: any[] = [];
      try {
        // Try raw SQL first to bypass any Client validation errors regarding missing columns
        // We use double quotes for all identifiers to be safe with PostgreSQL case-sensitivity
        usersWithAuto = await prisma.$queryRawUnsafe(`
          SELECT s.*, 
                 (SELECT row_to_json(u) FROM "synapse"."User" u WHERE u."id" = s."userId") as user
          FROM "synapse"."UserSettings" s
          WHERE s."autoTrading" = true
        `);
      } catch (rawErr) {
        console.warn("[Daemon] Raw SQL settings fetch failed, trying fallback raw SQL:", rawErr);
        try {
          // Try without schema prefix in case search_path is already set
          usersWithAuto = await prisma.$queryRawUnsafe(`
            SELECT s.*, 
                   (SELECT row_to_json(u) FROM "User" u WHERE u."id" = s."userId") as user
            FROM "UserSettings" s
            WHERE s."autoTrading" = true
          `);
        } catch (rawErr2) {
          console.error("[Daemon] All raw SQL attempts failed, trying standard Prisma query:", rawErr2);
          try {
            usersWithAuto = await (prisma as any).userSettings.findMany({
              where: { autoTrading: true },
              include: { user: true },
            });
          } catch (stdErr: any) {
             console.error("[Daemon] All attempts to fetch active users failed. Skipping this candle.", stdErr);
             return;
          }
        }
      }

      // Final sanitization of the riskPerTradePct field
      usersWithAuto = usersWithAuto.map(u => ({
        ...u,
        riskPerTradePct: u.riskPerTradePct !== undefined ? u.riskPerTradePct : 2.0
      }));

      // A. Log strategy-level rejections (like regime mismatch) to DB for all active users
      const blockedRaw = (rawSignals || []).filter(r => r.blocked);
      for (const rawSig of blockedRaw) {
        for (const settings of usersWithAuto) {
          try {
            await prisma.tradeSignal.create({
              data: {
                symbol: sym,
                timeframe: tf,
                strategyId: rawSig.strategyId,
                direction: rawSig.signalType || rawSig.signal,
                confidence: rawSig.confidence,
                entry: rawSig.entry,
                stopLoss: rawSig.stopLoss || 0,
                takeProfit: rawSig.takeProfit || 0,
                timestamp: new Date(rawSig.timestamp),
                reasoning: rawSig.reasoning,
                userId: settings.userId,
                tradingMode: settings.preferredTradingMode,
                blocked: true,
                blockReason: rawSig.blockReason || "Strategy rejected by prioritization manager.",
                marketRegime: regime,
                atr: (indicators.atr && indicators.atr.length > 0) ? indicators.atr[indicators.atr.length - 1] : 0,
              }
            });
          } catch (dbErr) {
            console.error("[Daemon] Failed to log prioritization rejection to DB:", dbErr);
          }
        }
      }

      // Process for each user independently
      for (const settings of usersWithAuto) {
        const userId = settings.userId;
        const userMode = settings.preferredTradingMode; // "SCALPING" | "INTRADAY"

        // Debug logging for user-level signal matching
        if (signals.length > 0) {
           console.log(`[USER_SIGNAL_AUDIT] User: ${userId} (${userMode}) | Total Global Signals: ${signals.length}`);
           signals.forEach(s => {
             const strat = strategyRegistry.getStrategy(s.strategyId);
             if (strat?.category !== userMode) {
               console.log(`  - [REJECTED_CATEGORY] Strategy: ${s.strategyName} (${strat?.category}) != User Mode (${userMode})`);
             }
           });
        }

        // Sync active positions from DB to memory for this user to ensure manual closures on the frontend are reflected
        try {
          await PaperTradingEngine.loadActivePositions(userId);
        } catch (err) {
          console.error(`[Daemon] Failed to sync active positions for user ${userId} in callback:`, err);
        }

      // 1. Filter signals matching preferredTradingMode
      const matchedSignals = signals.filter(sig => {
        if (sig.signal !== "LONG" && sig.signal !== "SHORT") return false;
        const strat = strategyRegistry.getStrategy(sig.strategyId);
        return strat?.category === userMode;
      });

      if (matchedSignals.length === 0) {
        if (signals.length > 0) console.log(`  - [SIGNAL_FLOW] No signals matched for user ${userId} (${userMode})`);
        continue;
      }

      // 2. Rank signals
      const rankedSignals = matchedSignals.map(sig => {
        const strat = strategyRegistry.getStrategy(sig.strategyId);
        const stats = PerformanceWeightingEngine.getStats(sig.strategyId);
        const profitFactor = stats ? stats.profitFactor : 1.0;
        const winRate = stats ? stats.winRate : 0.50;

        const lastVal = (arr?: number[]) => {
          if (!arr || arr.length === 0) return 0;
          return arr[arr.length - 1];
        };

        const candlesCache = useMarketStore.getState().allCandles[`${sym}_${tf}`] || [];
        const tickerCache = useMarketStore.getState().tickerData[sym] || null;
        const stratContext = {
          symbol: sym,
          timeframe: tf,
          candles: candlesCache,
          indicators,
          ticker: tickerCache
        };

        const lastCandle = candlesCache[candlesCache.length - 1];
        const lastVol = lastCandle ? lastCandle.volume : 0;
        const lastVolMA = lastVal(indicators.volumeMA) || 0;
        const volumeRatio = lastVolMA > 0 ? Number((lastVol / lastVolMA).toFixed(2)) : 1.0;

        // System-managed ATR stop loss and take profit multipliers
        const lastIdx = indicators.atr ? indicators.atr.length - 1 : -1;
        const atrVal = (lastIdx >= 0 && indicators.atr[lastIdx]) ? indicators.atr[lastIdx] : (sig.entry * 0.015);

        const slMult = userMode === "SCALPING" ? 0.8 : 1.5;
        const tpMult = userMode === "SCALPING" ? 1.2 : 3.0;

        const atrSlDist = slMult * atrVal;
        const atrTpDist = tpMult * atrVal;

        const direction = sig.signal;
        const atrSl = direction === "LONG" ? sig.entry - atrSlDist : sig.entry + atrSlDist;
        const atrTp = direction === "LONG" ? sig.entry + atrTpDist : sig.entry - atrTpDist;

        const finalSl = atrSl > 0 ? atrSl : (direction === "LONG" ? sig.entry * 0.95 : sig.entry * 1.05);
        const finalTp = atrTp > 0 ? atrTp : (direction === "LONG" ? sig.entry * 1.10 : sig.entry * 0.90);

        const risk = Math.abs(sig.entry - finalSl);
        const reward = Math.abs(finalTp - sig.entry);
        const riskRewardRatio = risk > 0 ? reward / risk : 1.5;

        // Confidence calculation
        const detailedConf = ConfidenceEngine.calculateDetailed(sig.signal as any, stratContext, sig.strategyId);
        const confidenceScore = detailedConf.finalScore;

        // Regime compatibility
        const category = sig.strategyCategory || "Central Engine";
        const isTrendingStrat = category === "Trend Following" || category === "Sentiment" || category === "Defensive";
        const isMeanReversionStrat = category === "Reversal" || category === "Mean-Reversion" || category === "MeanReversion" || category === "Grid";
        const isBreakoutStrat = category === "Breakout" || category === "Volatility";
        const isSweepStrat = category === "LiquiditySweep" || category === "SupplyDemand";

        let regimeMatch = false;
        if (regime === "TRENDING" && isTrendingStrat) regimeMatch = true;
        else if ((regime === "RANGING" || regime === "LOW_VOLATILITY") && isMeanReversionStrat) regimeMatch = true;
        else if (regime === "HIGH_VOLATILITY" && isBreakoutStrat) regimeMatch = true;

        return {
          sig,
          confidenceScore,
          profitFactor,
          winRate,
          regimeMatch,
          riskRewardRatio,
          finalSl,
          finalTp,
          detailedConf,
          volumeRatio,
          lastVol,
          candlesCache,
          tickerCache,
          stratContext
        };
      });

      // Sort signals by:
      // 1. Confidence Score
      // 2. Profit Factor
      // 3. Win Rate
      // 4. Regime Match
      // 5. Risk/Reward Ratio
      rankedSignals.sort((a, b) => {
        if (b.confidenceScore !== a.confidenceScore) {
          return b.confidenceScore - a.confidenceScore;
        }
        if (b.profitFactor !== a.profitFactor) {
          return b.profitFactor - a.profitFactor;
        }
        if (b.winRate !== a.winRate) {
          return b.winRate - a.winRate;
        }
        if (a.regimeMatch !== b.regimeMatch) {
          return a.regimeMatch ? -1 : 1; // True first
        }
        return b.riskRewardRatio - a.riskRewardRatio;
      });

      // Now process each ranked signal for this user
      for (const ranked of rankedSignals) {
        const { sig, confidenceScore, finalSl, finalTp, riskRewardRatio, detailedConf, volumeRatio, lastVol } = ranked;
        const direction = sig.signal as "LONG" | "SHORT";

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
          console.log(`  - [REJECTED_POSITION_EXISTS] ${sym} already has an open position for user ${userId}`);
          AuditLogger.logSignalRejected({ strategyId: sig.strategyId, symbol: sym, reason: `Active position already exists for user ${userId}` });
          try {
            await prisma.tradeSignal.create({
              data: {
                symbol: sym,
                timeframe: tf,
                strategyId: sig.strategyId,
                direction: sig.signal,
                confidence: sig.confidence,
                entry: sig.entry,
                stopLoss: finalSl,
                takeProfit: finalTp,
                timestamp: new Date(sig.timestamp),
                reasoning: sig.reasoning,
                userId: userId,
                tradingMode: userMode,
                blocked: true,
                blockReason: "ACTIVE POSITION EXISTS: The trade execution was rejected because a position is already open.",
                activePositionId: existingOpen.id,
                confidenceScore: confidenceScore,
                marketRegime: regime,
                atr: atrVal,
                positionSizeUsdt: estimatedSizeUsdt,
              }
            });
          } catch (dbErr) {
            console.error("[Daemon] Failed to log active position rejection to DB:", dbErr);
          }
          continue;
        }

        // A. Check quarantine status
        if (PerformanceWeightingEngine.isQuarantined(sig.strategyId)) {
          console.log(`  - [REJECTED_QUARANTINE] Strategy ${sig.strategyId} is quarantined.`);
          AuditLogger.logQuarantineBlocked({ userId, symbol: sym, strategyId: sig.strategyId });
          try {
            await prisma.tradeSignal.create({
              data: {
                symbol: sym,
                timeframe: tf,
                strategyId: sig.strategyId,
                direction: sig.signal,
                confidence: sig.confidence,
                entry: sig.entry,
                stopLoss: finalSl,
                takeProfit: finalTp,
                timestamp: new Date(sig.timestamp),
                reasoning: sig.reasoning,
                userId: userId,
                blocked: true,
                blockReason: "STRATEGY QUARANTINED: Strategy was quarantined due to poor recent performance metrics.",
              }
            });
          } catch (dbErr) {
            console.error("[Daemon] Failed to log quarantine rejection to DB:", dbErr);
          }
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
            console.log(`  - [REJECTED_COOLDOWN] Symbol ${sym} in cooldown for ${remainingMins}m`);
            AuditLogger.logCooldownBlocked({ userId, symbol: sym, remainingMinutes: remainingMins, lastStatus: lastTrade.status });
            try {
              await prisma.tradeSignal.create({
                data: {
                  symbol: sym,
                  timeframe: tf,
                  strategyId: sig.strategyId,
                  direction: sig.signal,
                  confidence: sig.confidence,
                  entry: sig.entry,
                  stopLoss: finalSl,
                  takeProfit: finalTp,
                  timestamp: new Date(sig.timestamp),
                  reasoning: sig.reasoning,
                  userId: userId,
                  blocked: true,
                  blockReason: `COOLDOWN ACTIVE: Cooldown active (${remainingMins}m remaining, last status: ${lastTrade.status}).`,
                }
              });
            } catch (dbErr) {
              console.error("[Daemon] Failed to log cooldown rejection to DB:", dbErr);
            }
            continue;
          }
        }

        // C. Check one-trade-per-strategy protection
        const hasStratPosition = PaperTradingEngine.getOpenPositions().some(
          (p) => p.userId === userId && p.status === "OPEN" && p.strategyId === sig.strategyId && sig.strategyId !== "manual"
        );
        if (hasStratPosition) {
          const reason = `STRATEGY LIMIT: Active position already exists generated by strategy ${sig.strategyId}.`;
          console.log(`  - [REJECTED_STRATEGY_LIMIT] ${reason}`);
          AuditLogger.logSignalRejected({ strategyId: sig.strategyId, symbol: sym, reason });
          try {
            await prisma.tradeSignal.create({
              data: {
                symbol: sym,
                timeframe: tf,
                strategyId: sig.strategyId,
                direction: sig.signal,
                confidence: sig.confidence,
                entry: sig.entry,
                stopLoss: finalSl,
                takeProfit: finalTp,
                timestamp: new Date(sig.timestamp),
                reasoning: sig.reasoning,
                userId: userId,
                tradingMode: userMode,
                blocked: true,
                blockReason: reason,
                confidenceScore: confidenceScore,
                marketRegime: regime,
                atr: atrVal,
                positionSizeUsdt: estimatedSizeUsdt,
              }
            });
          } catch (dbErr) {
            console.error("[Daemon] Failed to log strategy limit rejection to DB:", dbErr);
          }
          continue;
        }

        // Calculate daily drawdown and dynamic sizing beforehand
        let dailyDrawdownPercent = 0;
        try {
          const startOfToday = new Date();
          startOfToday.setUTCHours(0, 0, 0, 0);
          const closedTradesToday = await prisma.trade.findMany({
            where: { userId, closedAt: { gte: startOfToday } },
            select: { netPnl: true }
          });
          const closedPnlToday = closedTradesToday.reduce((sum, t) => sum + t.netPnl, 0);
          const openPositions = Array.from(PaperTradingEngine.getOpenPositions()).filter(p => p.userId === userId);
          const floatingPnl = openPositions.reduce((sum, p) => sum + p.pnl, 0);
          const totalDailyPnl = closedPnlToday + floatingPnl;
          const startOfDayBalance = wallet.balance - closedPnlToday;
          if (startOfDayBalance > 0 && totalDailyPnl < 0) {
            dailyDrawdownPercent = (Math.abs(totalDailyPnl) / startOfDayBalance) * 100;
          }
        } catch (e) {}

        const hasCorrelatedPosition = PaperTradingEngine.getOpenPositions().some(
          (p) => p.userId === userId && p.status === "OPEN" && p.direction === direction && p.symbol !== sym
        );

        let pct = 5;
        if (confidenceScore < 60) {
          pct = 5 + (confidenceScore / 60) * 5;
        } else if (confidenceScore <= 80) {
          pct = 10 + ((confidenceScore - 60) / 20) * 15;
        } else {
          pct = 25 + ((confidenceScore - 80) / 20) * 5;
        }

        // Safety Rules for >30% sizing (Confidence > 90)
        if (confidenceScore > 90) {
          const isSafetyMet =
            regime === "TRENDING" &&
            dailyDrawdownPercent < 2 &&
            !hasCorrelatedPosition;

          if (isSafetyMet) {
            pct = 30 + ((confidenceScore - 90) / 10) * 20;
          } else {
            pct = 30; // clamp to recommended max of 30% if safety is not met
          }
        }

        pct = Math.min(50, Math.max(5, pct));
        const estimatedSizeUsdt = wallet.balance * (pct / 100);

        // D. Check correlation risk filter
        const correlatedExposureUsdt = PaperTradingEngine.getOpenPositions()
          .filter((p) => p.userId === userId && p.status === "OPEN" && p.direction === direction && p.symbol !== sym)
          .reduce((sum, p) => sum + (p.entryPrice * p.quantity), 0);
        const totalCorrelatedExposure = correlatedExposureUsdt + estimatedSizeUsdt;

        const correlationBlocked = hasCorrelatedPosition && (
          confidenceScore < 90 || totalCorrelatedExposure > wallet.balance * 0.50
        );

        if (correlationBlocked) {
          const reason = `CORRELATION LIMIT: Already have open correlated positions and either confidence is too low (< 90) or total exposure would exceed 50% ($${totalCorrelatedExposure.toFixed(2)} > $${(wallet.balance * 0.50).toFixed(2)}).`;
          console.log(`  - [REJECTED_CORRELATION] ${reason}`);
          AuditLogger.logSignalRejected({ strategyId: sig.strategyId, symbol: sym, reason });
          try {
            await prisma.tradeSignal.create({
              data: {
                symbol: sym,
                timeframe: tf,
                strategyId: sig.strategyId,
                direction: sig.signal,
                confidence: sig.confidence,
                entry: sig.entry,
                stopLoss: finalSl,
                takeProfit: finalTp,
                timestamp: new Date(sig.timestamp),
                reasoning: sig.reasoning,
                userId: userId,
                tradingMode: userMode,
                blocked: true,
                blockReason: reason,
                confidenceScore: confidenceScore,
                marketRegime: regime,
                atr: atrVal,
                positionSizeUsdt: estimatedSizeUsdt,
              }
            });
          } catch (dbErr) {
            console.error("[Daemon] Failed to log correlation limit rejection to DB:", dbErr);
          }
          continue;
        }

        // E. Check Max Open Trades Limit
        const userActivePositionsCount = PaperTradingEngine.getOpenPositions().filter(p => p.userId === userId).length;
        if (userActivePositionsCount >= settings.maxOpenTrades) {
          const reason = `RISK MANAGEMENT BLOCK: Max open positions limit reached (${settings.maxOpenTrades}).`;
          console.log(`  - [REJECTED_MAX_OPEN] ${reason}`);
          AuditLogger.logRiskRejected({ userId, symbol: sym, reason });
          try {
            await prisma.tradeSignal.create({
              data: {
                symbol: sym,
                timeframe: tf,
                strategyId: sig.strategyId,
                direction: sig.signal,
                confidence: sig.confidence,
                entry: sig.entry,
                stopLoss: finalSl,
                takeProfit: finalTp,
                timestamp: new Date(sig.timestamp),
                reasoning: sig.reasoning,
                userId: userId,
                tradingMode: userMode,
                blocked: true,
                blockReason: reason,
                confidenceScore: confidenceScore,
                marketRegime: regime,
                atr: atrVal,
                positionSizeUsdt: estimatedSizeUsdt,
              }
            });
          } catch (dbErr) {
            console.error("[Daemon] Failed to log max open trades rejection to DB:", dbErr);
          }
          continue;
        }

        // F. Check Insufficient Margin
        const requiredMargin = estimatedSizeUsdt;
        const usedMargin = PaperTradingEngine.getOpenPositions()
          .filter(p => p.status === "OPEN" && p.userId === userId)
          .reduce((sum, p) => sum + (p.entryPrice * p.quantity) / p.leverage, 0);
        const availableBalance = wallet.balance - usedMargin;

        if (requiredMargin > availableBalance) {
          const reason = `RISK MANAGEMENT BLOCK: Insufficient margin (Required: $${requiredMargin.toFixed(2)}, Available: $${availableBalance.toFixed(2)}).`;
          console.log(`  - [REJECTED_MARGIN] ${reason}`);
          AuditLogger.logRiskRejected({ userId, symbol: sym, reason });
          try {
            await prisma.tradeSignal.create({
              data: {
                symbol: sym,
                timeframe: tf,
                strategyId: sig.strategyId,
                direction: sig.signal,
                confidence: sig.confidence,
                entry: sig.entry,
                stopLoss: finalSl,
                takeProfit: finalTp,
                timestamp: new Date(sig.timestamp),
                reasoning: sig.reasoning,
                userId: userId,
                tradingMode: userMode,
                blocked: true,
                blockReason: reason,
                confidenceScore: confidenceScore,
                marketRegime: regime,
                atr: atrVal,
                positionSizeUsdt: estimatedSizeUsdt,
              }
            });
          } catch (dbErr) {
            console.error("[Daemon] Failed to log insufficient margin rejection to DB:", dbErr);
          }
          continue;
        }

        // Construct final audit payload for this user's execution
        const lastVal = (arr?: number[]) => {
          if (!arr || arr.length === 0) return 0;
          return arr[arr.length - 1];
        };
        const competitionList = (rawSignals || []).map(r => {
          return {
            strategyId: r.strategyId,
            strategyName: r.strategyName || r.strategyId,
            confidence: r.confidence,
            direction: r.signal,
            reasoning: r.reasoning
          };
        }).sort((a, b) => b.confidence - a.confidence);

        const otherStrategiesLost = (rawSignals || [])
          .filter(r => r.strategyId !== sig.strategyId)
          .map(r => {
            let reason = "Signal did not match winning direction or had lower confidence score.";
            if (r.signal === "HOLD") {
              reason = "Strategy generated a HOLD signal (neutral outlook).";
            } else if (r.signal !== sig.signal) {
              reason = `Strategy proposed a ${r.signal} signal, which conflicted with the winning ${sig.signal} direction.`;
            } else {
              reason = `Proposed a ${r.signal} signal with ${r.confidence}% confidence, but was out-prioritized.`;
            }
            return {
              strategyId: r.strategyId,
              strategyName: r.strategyName || r.strategyId,
              confidence: r.confidence,
              direction: r.signal,
              reason
            };
          });

        const entryAuditPayload = {
          marketSnapshot: {
            asset: sym,
            timeframe: tf,
            regime: regime || "UNKNOWN",
            volatility: lastVal(indicators.atr),
            volume: lastVol,
            trendStrength: lastVal(indicators.adx),
            summary: `Market regime classified as ${regime} with ${lastVal(indicators.adx) > 25 ? "strong" : "weak"} trend strength and ATR of ${lastVal(indicators.atr).toFixed(4)}.`
          },
          strategyCompetition: competitionList.length > 0 ? competitionList : [
            { strategyId: sig.strategyId, strategyName: sig.strategyName || sig.strategyId, confidence: sig.confidence, direction: sig.signal, reasoning: sig.reasoning }
          ],
          winningStrategy: {
            strategyId: sig.strategyId,
            strategyName: sig.strategyName || sig.strategyId,
            confidence: sig.confidence,
            selectionReason: sig.reasoning ? sig.reasoning.join(". ") : "Highest confidence score with regime alignment."
          },
          confidenceBreakdown: {
            trendScore: detailedConf.trendScore,
            momentumScore: detailedConf.momentumScore,
            volumeScore: detailedConf.volumeScore,
            regimeScore: detailedConf.regimeScore,
            confirmScore: detailedConf.confirmScore,
            perfBoost: detailedConf.perfBoost,
            finalScore: detailedConf.finalScore
          },
          tradeEvidence: {
            rsi: lastVal(indicators.rsi),
            ema20: lastVal(indicators.ema20),
            sma50: lastVal(indicators.sma50),
            macdHist: lastVal(indicators.macdHist),
            adx: lastVal(indicators.adx),
            atr: lastVal(indicators.atr),
            volumeRatio
          },
          tradePlan: {
            direction: sig.signal,
            entryPrice: sig.entry,
            stopLoss: finalSl,
            takeProfit: finalTp,
            riskRewardRatio,
            sizeUsdt: estimatedSizeUsdt,
            quantity: estimatedSizeUsdt / sig.entry
          },
          executionCosts: {
            entryFee: 0,
            exitFee: 0,
            totalFees: 0,
            grossPnl: 0,
            netPnl: 0
          },
          otherStrategiesLost,
          executiveSummary: `An autonomous ${sig.signal} position was opened on ${sym} at $${sig.entry}. Winning strategy ${sig.strategyName || sig.strategyId} achieved confidence score of ${confidenceScore}% in a ${regime} market structure under ${userMode} mode.`
        };

        const enrichedSig = {
          ...sig,
          confidence: confidenceScore,
          auditPayload: entryAuditPayload
        };

        try {
          const position = await PaperTradingEngine.openPosition(
            userId,
            sym,
            direction,
            sig.entry,
            null, // Auto-size based on confidence
            finalSl,
            finalTp,
            1, // 1x leverage
            wallet.balance,
            {
              autoTrading: settings.autoTrading,
              maxOpenTrades: settings.maxOpenTrades,
              preferredTradingMode: userMode,
            },
            enrichedSig
          );

          if (position) {
            console.log(`[MULTI-TENANT DEBUG] TRADE GENERATED -> userId: ${userId}, strategyId: ${sig.strategyId}, positionId: ${position.id}, symbol: ${sym}, side: ${direction}, entry: ${sig.entry}, sizeUsdt: ${estimatedSizeUsdt}`);
            AuditLogger.logTradeExecuted({
              userId,
              symbol: sym,
              direction,
              entry: sig.entry,
              sl: finalSl,
              tp: finalTp,
              quantity: position.quantity,
              strategyName: sig.strategyName || "Unknown Strategy",
              confidence: confidenceScore
            });

            // Log successful execution to TradeSignal DB
            try {
              await prisma.tradeSignal.create({
                data: {
                  symbol: sym,
                  timeframe: tf,
                  strategyId: sig.strategyId,
                  direction: sig.signal,
                  confidence: confidenceScore,
                  entry: sig.entry,
                  stopLoss: finalSl,
                  takeProfit: finalTp,
                  timestamp: new Date(sig.timestamp),
                  reasoning: sig.reasoning,
                  userId: userId,
                  tradingMode: userMode,
                  blocked: false,
                  activePositionId: position.id,
                  confidenceScore: confidenceScore,
                  marketRegime: regime,
                  atr: atrVal,
                  positionSizeUsdt: estimatedSizeUsdt,
                }
              });
            } catch (dbErr) {
              console.error("[Daemon] Failed to log executed signal to DB:", dbErr);
            }
          }
        } catch (err) {
          AuditLogger.logSystemError({ module: "Daemon", message: `Autonomous trade placement failed for user ${userId}`, errorDetails: err });
        }
      }
    }
    } catch (err) {
      console.error("[Daemon] Fatal error in strategyEngine callback:", err);
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
