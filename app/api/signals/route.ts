import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, data } = body;

    if (type === "strategy-run") {
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
    } else if (type === "signals") {
      const { signals } = data;
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

        // Ensure strategy exists in DB
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

        // Create modular Signal entry
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
    } else if (type === "indicator-snapshot") {
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
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API-Signals] Error logging to DB:", error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
