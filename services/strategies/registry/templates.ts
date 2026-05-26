import { BaseStrategy } from "../base/BaseStrategy";
import { StrategyContext, StrategySignal } from "../interfaces";

/**
 * EMA Crossover Template Strategy
 * Triggers LONG when fast EMA (12) is above slow EMA (26)
 * Triggers SHORT when fast EMA (12) is below slow EMA (26)
 */
export class EMACrossoverStrategy extends BaseStrategy {
  public id = "ema-crossover";
  public name = "EMA Crossover Template";
  public supportedTimeframes = ["5m", "15m"];

  public analyze(context: StrategyContext): StrategySignal {
    const { symbol, timeframe, candles, indicators } = context;
    
    // Fallback default HOLD signal
    const defaultSignal: StrategySignal = {
      symbol,
      direction: "HOLD",
      confidence: 0,
      timeframe,
      strategyId: this.id,
      timestamp: candles.length > 0 ? candles[candles.length - 1].time : Date.now(),
      indicators: { rsi: 50, macdHist: 0, price: candles.length > 0 ? candles[candles.length - 1].close : 0 },
      reasoning: "Insufficient data to calculate crossover."
    };

    if (candles.length < 2 || !indicators || !indicators.ema12 || !indicators.ema26 || indicators.ema12.length < 2) {
      return defaultSignal;
    }

    const lastIdx = candles.length - 1;
    const price = candles[lastIdx].close;
    const ema12Last = indicators.ema12[lastIdx];
    const ema26Last = indicators.ema26[lastIdx];
    const ema12Prev = indicators.ema12[lastIdx - 1];
    const ema26Prev = indicators.ema26[lastIdx - 1];
    const rsiLast = indicators.rsi[lastIdx] ?? 50;
    const macdHistLast = indicators.macdHist[lastIdx] ?? 0;

    let direction: "LONG" | "SHORT" | "HOLD" = "HOLD";
    let confidence = 0;
    let reasoning = "EMAs are parallel. No crossover detected.";

    const lastDiff = ema12Last - ema26Last;
    const prevDiff = ema12Prev - ema26Prev;

    // Check for crossovers
    if (ema12Last > ema26Last) {
      direction = "LONG";
      // Confidence is higher if the crossover was recent (last 2 candles)
      confidence = prevDiff <= 0 ? 80 : 60;
      reasoning = prevDiff <= 0
        ? `Bullish Crossover: EMA(12) crossed above EMA(26) at $${price.toFixed(2)}.`
        : `Bullish Trend: EMA(12) is maintaining support above EMA(26).`;
    } else if (ema12Last < ema26Last) {
      direction = "SHORT";
      confidence = prevDiff >= 0 ? 80 : 60;
      reasoning = prevDiff >= 0
        ? `Bearish Crossover: EMA(12) crossed below EMA(26) at $${price.toFixed(2)}.`
        : `Bearish Trend: EMA(12) is locked below EMA(26).`;
    }

    return {
      symbol,
      direction,
      confidence,
      timeframe,
      strategyId: this.id,
      timestamp: candles[lastIdx].time,
      indicators: {
        rsi: rsiLast,
        macdHist: macdHistLast,
        price,
        ema12: ema12Last,
        ema26: ema26Last
      },
      reasoning
    };
  }
}

/**
 * RSI Momentum Template Strategy
 * Triggers LONG when RSI is oversold (< 30) indicating a reversal
 * Triggers SHORT when RSI is overbought (> 70) indicating a correction
 */
export class RSIMomentumStrategy extends BaseStrategy {
  public id = "rsi-momentum";
  public name = "RSI Momentum Template";
  public supportedTimeframes = ["5m", "15m"];

  public analyze(context: StrategyContext): StrategySignal {
    const { symbol, timeframe, candles, indicators } = context;

    const defaultSignal: StrategySignal = {
      symbol,
      direction: "HOLD",
      confidence: 0,
      timeframe,
      strategyId: this.id,
      timestamp: candles.length > 0 ? candles[candles.length - 1].time : Date.now(),
      indicators: { rsi: 50, macdHist: 0, price: candles.length > 0 ? candles[candles.length - 1].close : 0 },
      reasoning: "RSI indicators unavailable."
    };

    if (candles.length === 0 || !indicators || !indicators.rsi || indicators.rsi.length === 0) {
      return defaultSignal;
    }

    const lastIdx = candles.length - 1;
    const price = candles[lastIdx].close;
    const rsiLast = indicators.rsi[lastIdx];
    const macdHistLast = indicators.macdHist[lastIdx] ?? 0;

    let direction: "LONG" | "SHORT" | "HOLD" = "HOLD";
    let confidence = 0;
    let reasoning = `RSI at ${rsiLast.toFixed(1)} is in neutral range (30-70).`;

    if (rsiLast <= 30) {
      direction = "LONG";
      // Scale confidence between 50 and 95 based on how oversold it is
      confidence = Math.min(95, Math.max(50, Math.round(50 + (30 - rsiLast) * 2.25)));
      reasoning = `Oversold Conditions: RSI reached ${rsiLast.toFixed(1)} (<= 30), suggesting a strong probability of bullish rebound.`;
    } else if (rsiLast >= 70) {
      direction = "SHORT";
      // Scale confidence between 50 and 95 based on how overbought it is
      confidence = Math.min(95, Math.max(50, Math.round(50 + (rsiLast - 70) * 2.25)));
      reasoning = `Overbought Conditions: RSI reached ${rsiLast.toFixed(1)} (>= 70), indicating exhaust in buying pressure and upcoming pullback.`;
    }

    return {
      symbol,
      direction,
      confidence,
      timeframe,
      strategyId: this.id,
      timestamp: candles[lastIdx].time,
      indicators: {
        rsi: rsiLast,
        macdHist: macdHistLast,
        price
      },
      reasoning
    };
  }
}
