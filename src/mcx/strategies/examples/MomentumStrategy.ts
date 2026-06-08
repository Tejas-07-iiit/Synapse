import { IndicatorEngine } from "../../indicators/IndicatorEngine";
import type { MCXStrategy, StrategyContext, StrategyDecision } from "../sdk/Strategy";

export class MomentumStrategy implements MCXStrategy {
  id = "mcx.momentum.v2";
  name = "Momentum";
  timeframe = "5m" as const;

  async analyze(context: StrategyContext): Promise<StrategyDecision> {
    const candles = context.candles.filter((c) => c.isClosed);
    if (candles.length < 30) return { direction: "HOLD", confidence: 0 };
    const indicators = IndicatorEngine.calculate(candles);
    const latest = candles[candles.length - 1];
    const prev = candles[candles.length - 2];
    const atr = indicators.atr;
    if (!atr || !indicators.rsi || !indicators.macdHistogram) return { direction: "HOLD", confidence: 0 };
    if (latest.close > prev.close && indicators.rsi > 55 && indicators.macdHistogram > 0) {
      return { direction: "BUY", confidence: 0.62, stopLoss: latest.close - atr, takeProfit: latest.close + atr * 2, metadata: indicators as Record<string, unknown> };
    }
    if (latest.close < prev.close && indicators.rsi < 45 && indicators.macdHistogram < 0) {
      return { direction: "SELL", confidence: 0.62, stopLoss: latest.close + atr, takeProfit: latest.close - atr * 2, metadata: indicators as Record<string, unknown> };
    }
    return { direction: "HOLD", confidence: 0, metadata: indicators as Record<string, unknown> };
  }
}
