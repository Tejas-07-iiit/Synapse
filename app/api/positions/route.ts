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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, data } = body;

    if (action === "open") {
      const { userId, symbol, direction, entryPrice, quantity, stopLoss, takeProfit, leverage, strategyId, strategyName, strategyCategory, entryReason, confidenceAtEntry, marketRegime, indicatorSnapshot } = data;

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

      // Try to find the position to inherit missing properties if needed
      const existingPos = await prisma.position.findUnique({
        where: { id },
      });

      const finalUserId = userId || existingPos?.userId || "default-user-id";

      await ensureUserExists(finalUserId);

      const finalSymbol = symbol || existingPos?.symbol || "BTCUSDT";
      const finalDirection = direction || existingPos?.direction || "LONG";
      const finalEntryPrice = entryPrice || existingPos?.entryPrice || exitPrice;
      const finalStopLoss = stopLoss !== undefined ? stopLoss : existingPos?.stopLoss;
      const finalTakeProfit = takeProfit !== undefined ? takeProfit : existingPos?.takeProfit;
      const finalLeverage = leverage || existingPos?.leverage || 1;
      const finalOpenedAt = data.openedAt ? new Date(data.openedAt) : (existingPos?.openedAt || new Date());
      const finalClosedAt = closedAt ? new Date(closedAt) : new Date();

      await prisma.position.update({
        where: { id },
        data: {
          status: "CLOSED",
          currentPrice: exitPrice,
          pnl,
          closedAt: finalClosedAt,
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
      const isLong = finalDirection === "LONG";
      const priceDiff = isLong ? (exitPrice - finalEntryPrice) : (finalEntryPrice - exitPrice);
      const roi = (priceDiff / finalEntryPrice) * 100 * finalLeverage;

      const finalStrategyId = existingPos?.strategyId || data.strategyId || null;
      const finalStrategyName = existingPos?.strategyName || data.strategyName || "Central Engine";
      const finalStrategyCategory = existingPos?.strategyCategory || data.strategyCategory || null;
      const finalEntryReason = existingPos?.entryReason || data.entryReason || null;
      const finalConfidenceAtEntry = existingPos?.confidenceAtEntry || data.confidenceAtEntry || null;
      const finalMarketRegime = existingPos?.marketRegime || data.marketRegime || null;
      const finalIndicatorSnapshot = existingPos?.indicatorSnapshot || data.indicatorSnapshot || null;
      const finalExitReason = data.exitReason || null;

      if (finalUserId) {
        await prisma.trade.create({
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
            quantity: data.quantity || existingPos?.quantity || 0,
            leverage: finalLeverage,
            pnl,
            roi,
            status: tradeStatus,
            openedAt: finalOpenedAt,
            closedAt: finalClosedAt,
            executionType: "PAPER",
          },
        });

        // Update Wallet Balance and Realized PnL
        await prisma.wallet.update({
          where: { userId: finalUserId },
          data: {
            balance: { increment: pnl },
            realizedPnl: { increment: pnl },
          }
        });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("[API-Positions] Error executing position action:", error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
