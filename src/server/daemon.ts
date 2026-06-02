import { PrismaClient } from "@prisma/client";
import { marketEngine } from "../market-engine/market-engine";
import { PaperTradingEngine } from "../execution-engine/paper";
import { strategyEngine } from "../strategy-engine/core/engine";
import { marketWsService } from "../market-engine/websocket";
import { useMarketStore } from "../stores/marketStore";
import { PerformanceWeightingEngine } from "../strategy-engine/core/performance-weighting";
import { ConfidenceEngine } from "../strategy-engine/core/confidence-engine";
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
          auditPayload: data.auditPayload || null,
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
  strategyEngine.registerCallback(async (symbol, timeframe, regime, signals, indicators, rawSignals) => {
    const sym = symbol.toUpperCase();
    const tf = timeframe.toLowerCase();

    // Query database for all users that have autoTrading enabled
    const usersWithAuto = await prisma.userSettings.findMany({
      where: { autoTrading: true },
      include: { user: true },
    });

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
              blocked: true,
              blockReason: rawSig.blockReason || "Strategy rejected by prioritization manager.",
            }
          });
        } catch (dbErr) {
          console.error("[Daemon] Failed to log prioritization rejection to DB:", dbErr);
        }
      }
    }

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

      // Generate Entry Audit Payload
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
      
      const detailedConf = ConfidenceEngine.calculateDetailed(sig.signal as any, stratContext, sig.strategyId);

      const lastCandle = candlesCache[candlesCache.length - 1];
      const lastVol = lastCandle ? lastCandle.volume : 0;
      const lastVolMA = lastVal(indicators.volumeMA) || 0;
      const volumeRatio = lastVolMA > 0 ? Number((lastVol / lastVolMA).toFixed(2)) : 1.0;

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

      // Calculate final TP and SL to be used in trade plan
      const atrVal = (lastVal(indicators.atr)) || (sig.entry * 0.015);
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

      const atrSl = sig.signal === "LONG" ? sig.entry - atrSlDist : sig.entry + atrSlDist;
      const atrTp = sig.signal === "LONG" ? sig.entry + atrTpDist : sig.entry - atrTpDist;

      const finalSl = atrSl > 0 ? atrSl : (sig.signal === "LONG" ? sig.entry * 0.95 : sig.entry * 1.05);
      const finalTp = atrTp > 0 ? atrTp : (sig.signal === "LONG" ? sig.entry * 1.10 : sig.entry * 0.90);

      const risk = Math.abs(sig.entry - finalSl);
      const reward = Math.abs(finalTp - sig.entry);
      const riskRewardRatio = risk > 0 ? Number((reward / risk).toFixed(2)) : 1.5;

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
          sizeUsdt: 0,
          quantity: 0
        },
        executionCosts: {
          entryFee: 0,
          exitFee: 0,
          totalFees: 0,
          grossPnl: 0,
          netPnl: 0
        },
        otherStrategiesLost,
        executiveSummary: `A autonomous ${sig.signal} position was opened on ${sym} at $${sig.entry}. Winning strategy ${sig.strategyName || sig.strategyId} achieved confidence score of ${sig.confidence}% in a ${regime} market structure.`
      };

      (sig as any).auditPayload = entryAuditPayload;

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
          try {
            await prisma.tradeSignal.create({
              data: {
                symbol: sym,
                timeframe: tf,
                strategyId: sig.strategyId,
                direction: sig.signal,
                confidence: sig.confidence,
                entry: sig.entry,
                stopLoss: sig.stopLoss || 0,
                takeProfit: sig.takeProfit || 0,
                timestamp: new Date(sig.timestamp),
                reasoning: sig.reasoning,
                userId: userId,
                blocked: true,
                blockReason: "ACTIVE POSITION EXISTS: The trade execution was rejected because a position is already open.",
                activePositionId: existingOpen.id,
              }
            });
          } catch (dbErr) {
            console.error("[Daemon] Failed to log active position rejection to DB:", dbErr);
          }
          continue;
        }

        // A. Check quarantine status
        if (PerformanceWeightingEngine.isQuarantined(sig.strategyId)) {
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
                stopLoss: sig.stopLoss || 0,
                takeProfit: sig.takeProfit || 0,
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
                  stopLoss: sig.stopLoss || 0,
                  takeProfit: sig.takeProfit || 0,
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

        // D. Check Max Open Trades Limit (Risk Manager Check)
        const userActivePositionsCount = PaperTradingEngine.getOpenPositions().filter(p => p.userId === userId).length;
        if (userActivePositionsCount >= settings.maxOpenTrades) {
          const reason = `RISK MANAGEMENT BLOCK: Max open positions limit reached (${settings.maxOpenTrades}).`;
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
                blocked: true,
                blockReason: reason,
              }
            });
          } catch (dbErr) {
            console.error("[Daemon] Failed to log max open trades rejection to DB:", dbErr);
          }
          continue;
        }

        // E. Check Insufficient Margin (Risk Manager Check)
        const dummyOrderQty = (wallet.balance * (settings.riskPerTradePct / 100)) / sig.entry;
        const requiredMargin = dummyOrderQty * sig.entry;
        const usedMargin = PaperTradingEngine.getOpenPositions()
          .filter(p => p.status === "OPEN" && p.userId === userId)
          .reduce((sum, p) => sum + (p.entryPrice * p.quantity) / p.leverage, 0);
        const availableBalance = wallet.balance - usedMargin;
        if (requiredMargin > availableBalance) {
          const reason = `RISK MANAGEMENT BLOCK: Insufficient margin (Required: $${requiredMargin.toFixed(2)}, Available: $${availableBalance.toFixed(2)}).`;
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
                blocked: true,
                blockReason: reason,
              }
            });
          } catch (dbErr) {
            console.error("[Daemon] Failed to log insufficient margin rejection to DB:", dbErr);
          }
          continue;
        }

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

            // Log successful execution to TradeSignal DB
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
                  blocked: false,
                  activePositionId: position.id,
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
