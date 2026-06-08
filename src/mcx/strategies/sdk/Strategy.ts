import type { McxCandle } from "@prisma/client";
import type { MCXInterval } from "../../config/mcx.config";
import type { MCXDirection, MCXSignal } from "../../types";

export interface StrategyContext {
  userId: string;
  symbol: string;
  timeframe: MCXInterval;
  candles: McxCandle[];
}

export interface StrategyDecision {
  direction: MCXDirection;
  confidence: number;
  stopLoss?: number;
  takeProfit?: number;
  metadata?: Record<string, unknown>;
}

export interface MCXStrategy {
  id: string;
  name: string;
  timeframe: MCXInterval;
  analyze(context: StrategyContext): Promise<StrategyDecision>;
}

export function signalFromDecision(strategy: MCXStrategy, context: StrategyContext, decision: StrategyDecision): MCXSignal {
  const latest = context.candles[context.candles.length - 1];
  if (!latest) throw new Error("Strategy cannot emit a signal without closed candles");
  return {
    userId: context.userId,
    symbol: context.symbol,
    direction: decision.direction,
    confidence: decision.confidence,
    strategyId: strategy.id,
    strategyName: strategy.name,
    timeframe: strategy.timeframe,
    entryPrice: latest.close,
    stopLoss: decision.stopLoss ?? latest.close,
    takeProfit: decision.takeProfit ?? latest.close,
    generatedAt: new Date(),
    metadata: decision.metadata,
  };
}
