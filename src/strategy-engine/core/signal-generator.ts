import { StrategyContext, StrategySignal } from "../types";
import { RegimeEngine } from "./regime-engine";

const STRATEGY_NAMES: Record<string, string> = {
  "ema-crossover": "EMA Crossover Strategy",
  "rsi-reversal": "RSI Reversal Strategy",
  "macd-momentum": "MACD Momentum Strategy",
  "bollinger-breakout": "Bollinger Breakout Strategy",
  "mean-reversion": "Mean Reversion Strategy",
  "momentum": "Momentum Strategy",
  "defensive": "Defensive Strategy",
  "grid": "Grid Strategy",
  "lorentzian": "Lorentzian Classification",
  "donchian-breakout": "Donchian Breakout Strategy",
  "rally-base-drop": "Rally Base Drop Strategy",
  "sr-sweep": "Support Resistance Sweep Strategy",
  "bollinger-reversion": "Bollinger Reversion Strategy",
  "short-term-reversal": "Short Term Reversal Strategy",
  "dow-mfi-rsi": "Dow Factor MFI RSI Strategy",
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
    context: StrategyContext,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    marketContextOverride?: any
  ): StrategySignal {
    const { symbol, timeframe, candles, indicators } = context;
    const lastIdx = candles.length - 1;
    
    const entry = lastIdx >= 0 ? candles[lastIdx].close : 0;
    const open = lastIdx >= 0 ? candles[lastIdx].open : 0;
    const high = lastIdx >= 0 ? candles[lastIdx].high : 0;
    const low = lastIdx >= 0 ? candles[lastIdx].low : 0;
    const volume = lastIdx >= 0 ? candles[lastIdx].volume : 0;
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

    // Capture new indicators
    const stochRsiK = indicators?.stochRsiK?.[lastIdx];
    const stochRsiD = indicators?.stochRsiD?.[lastIdx];
    const adx = indicators?.adx?.[lastIdx];
    const support = indicators?.supportLevels?.[lastIdx];
    const resistance = indicators?.resistanceLevels?.[lastIdx];

    // Calculate default market context if not provided
    let marketContext = marketContextOverride;
    if (!marketContext && lastIdx >= 0) {
      const regime = RegimeEngine.classify(context);
      const regimeCategory = RegimeEngine.getRegimeCategory(context);
      
      const bbUpper = indicators?.bbUpper?.[lastIdx] || 0;
      const bbLower = indicators?.bbLower?.[lastIdx] || 0;
      const bbMiddle = indicators?.bbMiddle?.[lastIdx] || 1;
      const currentWidth = (bbUpper - bbLower) / bbMiddle;
      
      const prevBbUpper = lastIdx > 0 ? (indicators?.bbUpper?.[lastIdx - 1] || bbUpper) : bbUpper;
      const prevBbLower = lastIdx > 0 ? (indicators?.bbLower?.[lastIdx - 1] || bbLower) : bbLower;
      const prevBbMiddle = lastIdx > 0 ? (indicators?.bbMiddle?.[lastIdx - 1] || bbMiddle) : bbMiddle;
      const prevBbWidth = (prevBbUpper - prevBbLower) / (prevBbMiddle || 1);

      const isExpanding = currentWidth > prevBbWidth;

      const volumeMA = indicators?.volumeMA?.[lastIdx] || 1;
      const candleRange = high - low || 1;
      const bodyRatio = Math.abs(entry - open) / candleRange;
      const upperWick = high - Math.max(open, entry);
      const lowerWick = Math.min(open, entry) - low;

      marketContext = {
        regime,
        regimeCategory,
        volatilityState: {
          currentWidth,
          avgWidth: prevBbWidth,
          isExpanding,
          atr,
        },
        breakoutStrength: {
          bbWidth: currentWidth,
          prevBbWidth,
          bodyRatio,
          volumeRatio: volumeMA > 0 ? volume / volumeMA : 1,
          upperWickRatio: upperWick / candleRange,
          lowerWickRatio: lowerWick / candleRange,
        }
      };
    }

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
      marketContext,
    };
  }
}

