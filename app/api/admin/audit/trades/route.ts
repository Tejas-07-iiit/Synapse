import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "100");
    const userId = searchParams.get("userId") || undefined;

    const dbTrades = await prisma.trade.findMany({
      where: userId ? { userId } : undefined,
      orderBy: { closedAt: "desc" },
      take: limit,
      include: {
        user: {
          select: {
            username: true,
          }
        }
      }
    });

    const mapped = dbTrades.map((t) => ({
      id: t.id,
      userId: t.userId,
      username: t.user.username,
      symbol: t.symbol,
      strategyId: t.strategyId,
      strategyName: t.strategyName,
      direction: t.direction,
      entryPrice: t.entryPrice,
      exitPrice: t.exitPrice,
      stopLoss: t.stopLoss,
      takeProfit: t.takeProfit,
      quantity: t.quantity,
      leverage: t.leverage,
      pnl: t.pnl,
      roi: t.roi,
      status: t.status,
      openedAt: t.openedAt,
      closedAt: t.closedAt,
      tradingMode: t.tradingMode,
      marketRegime: t.marketRegime,
      atrAtEntry: t.atrAtEntry,
      entryReason: t.entryReason,
      exitReason: t.exitReason,
      confidence: t.confidence,
    }));

    return NextResponse.json({ success: true, trades: mapped });
  } catch (error) {
    console.error("[API-Audit-Trades] Error:", error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
