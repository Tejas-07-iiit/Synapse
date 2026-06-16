import prisma from "@/lib/prisma";
import { mcxConfig } from "../config/mcx.config";
import { MCXEventBus, MCXEventType } from "../events/EventBus";
import { mcxLogger } from "../utils/logger";
import { signalFromDecision } from "./sdk/Strategy";
import { StrategyRegistry } from "./StrategyRegistry";

export class StrategyEngine {
  private static initialized = false;
  private static lastEmittedSignals = new Map<string, string>(); // key: strategy_symbol_interval, value: last_timestamp

  static initialize() {
    if (this.initialized) return;
    this.initialized = true;
    MCXEventBus.on(MCXEventType.CANDLE_CLOSED, (candle) => void this.onCandleClosed(candle as Record<string, unknown>));
    mcxLogger.info("StrategyEngine Initialized", { strategies: StrategyRegistry.all().map((strategy) => strategy.id) });
  }

  private static async onCandleClosed(candle: Record<string, unknown>) {
    const symbol = String(candle.symbol);
    const interval = String(candle.interval);
    const timestamp = String(candle.timestamp);

    for (const strategy of StrategyRegistry.all().filter((item) => item.timeframe === interval)) {
      const dupKey = `${strategy.id}_${symbol}_${interval}`;
      if (this.lastEmittedSignals.get(dupKey) === timestamp) continue;
      this.lastEmittedSignals.set(dupKey, timestamp);

      const candles = await prisma.mcxCandle.findMany({
        where: { symbol, interval: strategy.timeframe, isClosed: true },
        orderBy: { timestamp: "desc" },
        take: mcxConfig.runtime.strategyLookbackCandles,
      });
      mcxLogger.info("StrategyEngine: Processing candle", { 
        symbol, 
        timeframe: strategy.timeframe, 
        candlesCount: candles.length, 
        lookbackLimit: mcxConfig.runtime.strategyLookbackCandles 
      });
      const context = {
        userId: mcxConfig.runtime.defaultUserId,
        symbol,
        timeframe: strategy.timeframe,
        candles: candles.reverse(),
      };
      const decision = await strategy.analyze(context);
      if (decision.direction === "HOLD") continue;
      const signal = signalFromDecision(strategy, context, decision);
      MCXEventBus.publish(MCXEventType.SIGNAL_GENERATED, signal as unknown as Record<string, unknown>);
    }
  }
}
