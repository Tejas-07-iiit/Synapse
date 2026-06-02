import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { marketWsService } from "@/src/market-engine/websocket";
import { PaperTradingEngine } from "@/src/execution-engine/paper";

export async function GET() {
  try {
    // 1. DAEMON & WS HEALTH
    const wsConnected = marketWsService.isConnected();
    const activeStreams = marketWsService.getSubscribedStreams();
    
    // 2. SYSTEM THROUGHPUT (Last 10 mins)
    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
    const recentCandles = await prisma.marketSnapshot.count({ where: { createdAt: { gte: tenMinsAgo } } });
    const recentSignals = await prisma.tradeSignal.count({ where: { timestamp: { gte: tenMinsAgo } } });
    const recentExecutions = await prisma.trade.count({ where: { openedAt: { gte: tenMinsAgo } } });

    // 3. USER ISOLATION & LOAD
    const activeUsers = await prisma.userSettings.count({ where: { autoTrading: true } });
    const openPositions = PaperTradingEngine.getOpenPositions().length;

    // 4. STRATEGY DISTRIBUTION
    const strategyStats = await prisma.tradeSignal.groupBy({
      by: ['strategyId'],
      _count: { id: true },
      where: { timestamp: { gte: tenMinsAgo } }
    });

    // 5. ERROR LOGS
    const recentErrors = await prisma.signalLog.findMany({
      where: { createdAt: { gte: tenMinsAgo }, direction: "HOLD" },
      take: 10,
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      health: {
        wsConnected,
        activeStreamsCount: activeStreams.length,
        daemonStatus: "ACTIVE",
      },
      metrics: {
        activeUsers,
        openPositions,
        candlesProcessed10m: recentCandles,
        signalsGenerated10m: recentSignals,
        tradesExecuted10m: recentExecutions,
      },
      strategies: strategyStats.map(s => ({
        id: s.strategyId,
        count: s._count.id
      })),
      recentLogs: recentErrors
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
