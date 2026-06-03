import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "100");
    const userId = searchParams.get("userId") || undefined;
    const type = searchParams.get("type") || "all"; // all, rejected, accepted

    const where: any = {};
    if (userId) {
      where.OR = [{ userId }, { userId: null }];
    }
    if (type === "rejected") {
      where.blocked = true;
    } else if (type === "accepted") {
      where.blocked = false;
    }

    const dbSignals = await prisma.tradeSignal.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: limit,
    });

    const mapped = dbSignals.map((s) => ({
      id: s.id,
      timestamp: s.timestamp,
      symbol: s.symbol,
      timeframe: s.timeframe,
      strategyId: s.strategyId,
      direction: s.direction,
      confidence: s.confidence,
      entry: s.entry,
      stopLoss: s.stopLoss,
      takeProfit: s.takeProfit,
      userId: s.userId,
      tradingMode: s.tradingMode,
      blocked: s.blocked,
      blockReason: s.blockReason,
      activePositionId: s.activePositionId,
      confidenceScore: s.confidenceScore,
      marketRegime: s.marketRegime,
      atr: s.atr,
      positionSizeUsdt: s.positionSizeUsdt,
      reasoning: s.reasoning,
    }));

    return NextResponse.json({ success: true, signals: mapped });
  } catch (error) {
    console.error("[API-Audit-Signals] Error:", error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
