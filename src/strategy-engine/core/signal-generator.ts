import { StrategyContext, StrategySignal } from "../types";

const STRATEGY_NAMES: Record<string, string> = {
  "ema-crossover": "EMA Crossover Strategy",
  "rsi-reversal": "RSI Reversal Strategy",
  "macd-momentum": "MACD Momentum Strategy",
  "bollinger-breakout": "Bollinger Breakout Strategy",
};

export class SignalGenerator {
  /**
   * Generates a standardized StrategySignal based on strategy evaluation output.
   */
  public static createSignal(
    strategyId: string,
    signal: "LONG" | "SHORT" | "HOLD",
    confidence: number,
    reasoning: string[],
    context: StrategyContext
  ): StrategySignal {
    const { symbol, timeframe, candles, indicators } = context;
    const lastIdx = candles.length - 1;
    
    const entry = lastIdx >= 0 ? candles[lastIdx].close : 0;
    const timestamp = lastIdx >= 0 ? candles[lastIdx].time : Date.now();
    const atr = (indicators && indicators.atr && lastIdx >= 0) 
      ? indicators.atr[lastIdx] 
      : (entry * 0.015); // Fallback: 1.5% of price

    let stopLoss = 0;
    let takeProfit = 0;

    if (signal === "LONG" && entry > 0) {
      stopLoss = entry - 1.8 * atr;
      takeProfit = entry + 3.2 * atr;
    } else if (signal === "SHORT" && entry > 0) {
      stopLoss = entry + 1.8 * atr;
      takeProfit = entry - 3.2 * atr;
    }

    // Capture standard indicators values to attach to the signal contract
    const rsi = indicators?.rsi?.[lastIdx];
    const ema = indicators?.ema20?.[lastIdx];
    const sma = indicators?.sma50?.[lastIdx];
    const macd = indicators?.macdHist?.[lastIdx];
    const volume = candles[lastIdx]?.volume;

    // Capture new indicators
    const stochRsiK = indicators?.stochRsiK?.[lastIdx];
    const stochRsiD = indicators?.stochRsiD?.[lastIdx];
    const adx = indicators?.adx?.[lastIdx];
    const support = indicators?.supportLevels?.[lastIdx];
    const resistance = indicators?.resistanceLevels?.[lastIdx];

    const strategyName = STRATEGY_NAMES[strategyId] || "AI Confluence Strategy";

    return {
      strategyId,
      strategyName,
      signal,
      signalType: signal,
      confidence,
      entry,
      stopLoss: Number(stopLoss.toFixed(4)),
      takeProfit: Number(takeProfit.toFixed(4)),
      symbol,
      timeframe,
      timestamp,
      reasoning,
      indicators: {
        rsi,
        ema,
        sma,
        macd,
        atr,
        volume,
        stochRsiK,
        stochRsiD,
        adx,
        support,
        resistance,
      },
    };
  }
}
