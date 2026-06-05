import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { ensureUserExists } from "@/services/user/userService";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || "default-user-id";
    const type = searchParams.get("type") || "active";

    if (type === "closed" || type === "history") {
      const trades = await prisma.trade.findMany({
        where: { userId },
        orderBy: { closedAt: "desc" },
      });
      return NextResponse.json({ success: true, trades });
    } else {
      const positions = await prisma.position.findMany({
        where: { userId, status: "OPEN" },
      });
      return NextResponse.json({ success: true, positions });
    }
  } catch (error) {
    console.error("[API-Positions] Error fetching positions/trades:", error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}

function generateManualAuditPayload(data: any) {
  const direction = data.direction;
  const entryPrice = data.entryPrice;
  const quantity = data.quantity || 0;
  const leverage = data.leverage || 1;

  const risk = data.stopLoss ? Math.abs(entryPrice - data.stopLoss) : 0;
  const reward = data.takeProfit ? Math.abs(data.takeProfit - entryPrice) : 0;
  const riskRewardRatio = risk > 0 ? Number((reward / risk).toFixed(2)) : 1.5;

  return {
    marketSnapshot: {
      asset: data.symbol,
      timeframe: "Manual",
      regime: data.marketRegime || "UNKNOWN",
      volatility: 0.0,
      volume: 0.0,
      trendStrength: 0.0,
      summary: "Manual trade executed directly by user."
    },
    strategyCompetition: [
      { strategyId: "manual", strategyName: "Manual Trade", confidence: 100, direction, reasoning: ["User initiated manual trade"] }
    ],
    winningStrategy: {
      strategyId: "manual",
      strategyName: "Manual Trade",
      confidence: 100,
      selectionReason: "Direct user execution"
    },
    confidenceBreakdown: {
      trendScore: 0,
      momentumScore: 0,
      volumeScore: 0,
      regimeScore: 0,
      confirmScore: 0,
      perfBoost: 0,
      finalScore: 100
    },
    tradeEvidence: {
      rsi: 50,
      ema20: entryPrice,
      sma50: entryPrice,
      macdHist: 0,
      adx: 0,
      atr: 0,
      volumeRatio: 1.0
    },
    tradePlan: {
      direction,
      entryPrice,
      stopLoss: data.stopLoss || null,
      takeProfit: data.takeProfit || null,
      riskRewardRatio,
      sizeUsdt: Number((entryPrice * quantity).toFixed(2)),
      quantity
    },
    executionCosts: {
      entryFee: Number((entryPrice * quantity * 0.001).toFixed(4)),
      exitFee: 0,
      totalFees: Number((entryPrice * quantity * 0.001).toFixed(4)),
      grossPnl: 0,
      netPnl: 0
    },
    otherStrategiesLost: [],
    executiveSummary: `Manual ${direction} trade executed by user on ${data.symbol} at $${entryPrice}.`
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, data } = body;

    if (action === "open") {
      const { userId, symbol, direction, entryPrice, quantity, stopLoss, takeProfit, leverage, strategyId, strategyName, strategyCategory, entryReason, confidenceAtEntry, marketRegime, indicatorSnapshot, auditPayload, expiresAt, confidenceScore } = data;

      await ensureUserExists(userId);

      // DATABASE-LEVEL POSITION LOCK
      // Ensure no open position already exists for this symbol and user
      const existingOpen = await prisma.position.findFirst({
        where: {
          userId,
          symbol,
          status: "OPEN",
        },
      });

      if (existingOpen) {
        console.warn(`[API-Positions] Blocked duplicate position creation for ${symbol} (User: ${userId})`);
        return NextResponse.json(
          { success: false, error: `An open position already exists for ${symbol}` },
          { status: 409 } // Conflict
        );
      }

      let finalAuditPayload = auditPayload || null;
      if (!finalAuditPayload) {
        finalAuditPayload = generateManualAuditPayload({
          symbol,
          direction,
          entryPrice,
          quantity,
          stopLoss,
          takeProfit,
          leverage,
          marketRegime
        });
      }

      const dbPos = await prisma.position.create({
        data: {
          userId,
          symbol,
          direction,
          entryPrice,
          currentPrice: entryPrice,
          quantity,
          stopLoss,
          takeProfit,
          leverage: leverage || 1,
          pnl: 0.0,
          status: "OPEN",
          strategyId: strategyId || null,
          strategyName: strategyName || null,
          strategyCategory: strategyCategory || null,
          entryReason: entryReason || null,
          confidenceAtEntry: confidenceAtEntry || null,
          marketRegime: marketRegime || null,
          indicatorSnapshot: indicatorSnapshot || null,
          auditPayload: finalAuditPayload,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          confidenceScore: confidenceScore || null,
        },
      });

      return NextResponse.json({ success: true, position: dbPos });
    } else if (action === "update") {
      const { id, currentPrice, pnl } = data;

      const dbPos = await prisma.position.update({
        where: { id },
        data: { currentPrice, pnl },
      });

      return NextResponse.json({ success: true, position: dbPos });
    } else if (action === "close") {
      const { id, exitPrice, pnl, closedAt, userId, symbol, direction, entryPrice, stopLoss, takeProfit, leverage, reason } = data;

      try {
        const result = await prisma.$transaction(async (tx) => {
          // 1. Try to find the position to inherit missing properties if needed
          const existingPos = await tx.position.findUnique({
            where: { id },
          });

          if (!existingPos) {
            throw new Error("POSITION_NOT_FOUND");
          }

          const finalUserId = userId || existingPos?.userId || "default-user-id";
          const finalSymbol = symbol || existingPos?.symbol || "BTCUSDT";
          const finalDirection = direction || existingPos?.direction || "LONG";
          const finalEntryPrice = entryPrice || existingPos?.entryPrice || exitPrice;
          const finalStopLoss = stopLoss !== undefined ? stopLoss : existingPos?.stopLoss;
          const finalTakeProfit = takeProfit !== undefined ? takeProfit : existingPos?.takeProfit;
          const finalLeverage = leverage || existingPos?.leverage || 1;
          const finalOpenedAt = data.openedAt ? new Date(data.openedAt) : (existingPos?.openedAt || new Date());
          const finalClosedAt = closedAt ? new Date(closedAt) : new Date();
          const finalExitReason = data.exitReason || null;

          // 2. Update position to CLOSED conditionally (prevents race condition)
          const updateResult = await tx.position.updateMany({
            where: {
              id,
              status: "OPEN",
            },
            data: {
              status: "CLOSED",
              currentPrice: exitPrice,
              pnl,
              closedAt: finalClosedAt,
              exitReason: finalExitReason || reason,
            },
          });

          if (updateResult.count === 0) {
            return { alreadyClosed: true };
          }

          // Map reason to status
          let tradeStatus = "CLOSED";
          if (reason === "STOP_LOSS" || reason === "STOPPED") {
            tradeStatus = "STOPPED";
          } else if (reason === "TAKE_PROFIT" || reason === "TP HIT") {
            tradeStatus = "TP HIT";
          }

          // Calculate ROI
          const isLong = finalDirection === "LONG";
          const priceDiff = isLong ? (exitPrice - finalEntryPrice) : (finalEntryPrice - exitPrice);
          const roi = (priceDiff / finalEntryPrice) * 100 * finalLeverage;

          const finalQuantity = data.quantity || existingPos?.quantity || 0;
          const entryValue = finalEntryPrice * finalQuantity;
          const exitValue = exitPrice * finalQuantity;
          const entryFee = entryValue * 0.001;
          const exitFee = exitValue * 0.001;
          const totalFees = entryFee + exitFee;
          const grossPnl = pnl;
          const netPnl = grossPnl - totalFees;

          const finalStrategyId = existingPos?.strategyId || data.strategyId || null;
          const finalStrategyName = existingPos?.strategyName || data.strategyName || "Central Engine";
          const finalStrategyCategory = existingPos?.strategyCategory || data.strategyCategory || null;
          const finalEntryReason = existingPos?.entryReason || data.entryReason || null;
          const finalConfidenceAtEntry = existingPos?.confidenceAtEntry || data.confidenceAtEntry || null;
          const finalMarketRegime = existingPos?.marketRegime || data.marketRegime || null;
          const finalIndicatorSnapshot = existingPos?.indicatorSnapshot || data.indicatorSnapshot || null;

          let finalAuditPayload = data.auditPayload || existingPos?.auditPayload || null;
          if (finalAuditPayload && typeof finalAuditPayload === "object") {
            finalAuditPayload = JSON.parse(JSON.stringify(finalAuditPayload));
          } else {
            finalAuditPayload = generateManualAuditPayload({
              symbol: finalSymbol,
              direction: finalDirection,
              entryPrice: finalEntryPrice,
              quantity: finalQuantity,
              stopLoss: finalStopLoss,
              takeProfit: finalTakeProfit,
              leverage: finalLeverage,
              marketRegime: finalMarketRegime
            });
          }

          // Update exitOutcome
          finalAuditPayload.exitOutcome = {
            exitPrice,
            exitReason: finalExitReason || reason,
            durationMs: new Date(finalClosedAt).getTime() - new Date(finalOpenedAt).getTime(),
            closedAt: new Date(finalClosedAt).getTime(),
          };

          finalAuditPayload.executionCosts = {
            entryFee,
            exitFee,
            totalFees,
            grossPnl,
            netPnl,
          };

          await tx.trade.create({
            data: {
              userId: finalUserId,
              symbol: finalSymbol,
              strategyId: finalStrategyId,
              strategyName: finalStrategyName,
              strategyCategory: finalStrategyCategory,
              entryReason: finalEntryReason,
              exitReason: finalExitReason,
              confidenceAtEntry: finalConfidenceAtEntry,
              confidence: finalConfidenceAtEntry || 0.8,
              marketRegime: finalMarketRegime,
              indicatorSnapshot: finalIndicatorSnapshot,
              direction: finalDirection,
              entryPrice: finalEntryPrice,
              exitPrice,
              currentPrice: exitPrice,
              stopLoss: finalStopLoss,
              takeProfit: finalTakeProfit,
              quantity: finalQuantity,
              leverage: finalLeverage,
              pnl,
              roi,
              status: tradeStatus,
              openedAt: finalOpenedAt,
              closedAt: finalClosedAt,
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

          // Update Wallet Balance and Realized PnL
          await tx.wallet.update({
            where: { userId: finalUserId },
            data: {
              balance: { increment: netPnl },
              realizedPnl: { increment: netPnl },
            }
          });

          return { success: true };
        });

        if (result.alreadyClosed) {
          console.warn(`[API-Positions] Blocked duplicate position close request for position ID ${id}`);
          return NextResponse.json({ success: true, message: "Position already closed" });
        }

        return NextResponse.json({ success: true });
      } catch (err: any) {
        if (err.message === "POSITION_NOT_FOUND") {
          return NextResponse.json({ success: false, error: "Position not found" }, { status: 404 });
        }
        throw err;
      }
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("[API-Positions] Error executing position action:", error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
