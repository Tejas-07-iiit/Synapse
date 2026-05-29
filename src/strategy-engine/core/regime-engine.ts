import { StrategyContext } from "../types";

export type MarketRegime =
  | "Bullish Trend"
  | "Bearish Trend"
  | "Ranging"
  | "Breakout"
  | "Distribution"
  | "Accumulation"
  | "High Volatility"
  | "Low Volatility";

export class RegimeEngine {
  /**
   * Evaluates technical indicator metrics to determine the current market regime.
   */
  public static classify(context: StrategyContext): MarketRegime {
    const { candles, indicators } = context;
    if (candles.length < 10) return "Ranging";

    const lastIdx = candles.length - 1;
    const price = candles[lastIdx].close;
    
    // 1. Calculate Bollinger Bands width and average width
    const bbUpper = indicators.bbUpper?.[lastIdx];
    const bbLower = indicators.bbLower?.[lastIdx];
    const bbMiddle = indicators.bbMiddle?.[lastIdx];
    
    let currentWidth = 0.05;
    let avgWidth = 0.05;
    if (bbUpper && bbLower && bbMiddle) {
      currentWidth = (bbUpper - bbLower) / bbMiddle;

      let widthSum = 0;
      let count = 0;
      const start = Math.max(0, lastIdx - 20);
      for (let i = start; i <= lastIdx; i++) {
        const u = indicators.bbUpper?.[i];
        const l = indicators.bbLower?.[i];
        const m = indicators.bbMiddle?.[i];
        if (u && l && m) {
          widthSum += (u - l) / m;
          count++;
        }
      }
      avgWidth = count > 0 ? widthSum / count : currentWidth;
    }

    // 2. Check EMA Slope over last 5 candles
    const ema20Last = indicators.ema20?.[lastIdx];
    const ema20Prev = indicators.ema20?.[Math.max(0, lastIdx - 5)] ?? ema20Last;
    const emaSlope = ema20Last ? (ema20Last - ema20Prev) / ema20Last : 0;

    // 3. Volume confirmation
    const volume = candles[lastIdx].volume;
    const volumeMA = indicators.volumeMA?.[lastIdx] ?? 0;
    const isVolumeExpanding = volumeMA > 0 && volume > volumeMA * 1.5;

    // 4. RSI metrics
    const rsi = indicators.rsi?.[lastIdx] ?? 50;
    const rsiPrev = indicators.rsi?.[Math.max(0, lastIdx - 3)] ?? rsi;

    // 5. MACD metrics
    const macdHist = indicators.macdHist?.[lastIdx] ?? 0;
    const macdHistPrev = indicators.macdHist?.[Math.max(0, lastIdx - 3)] ?? macdHist;

    // Classification Decision Tree
    
    // A. Volatility Extremes
    if (currentWidth < avgWidth * 0.7) {
      return "Low Volatility"; // Squeeze
    }
    
    // B. Breakout Regime (Bollinger expanding + High Volume)
    if (currentWidth > avgWidth * 1.2 && isVolumeExpanding) {
      return "Breakout";
    }

    // C. Trends
    const sma50 = indicators.sma50?.[lastIdx];
    if (ema20Last && sma50) {
      if (price > ema20Last && ema20Last > sma50 && emaSlope > 0.0005) {
        return "Bullish Trend";
      } else if (price < ema20Last && ema20Last < sma50 && emaSlope < -0.0005) {
        return "Bearish Trend";
      }
    }

    // D. Accumulation / Distribution (Ranging bounds with volume and oscillator signals)
    if (rsi < 40 && macdHist > macdHistPrev && rsi > rsiPrev) {
      return "Accumulation";
    }
    if (rsi > 60 && macdHist < macdHistPrev && rsi < rsiPrev) {
      return "Distribution";
    }

    if (currentWidth > avgWidth * 1.35) {
      return "High Volatility";
    }

    // E. Default sideways ranging channel
    return "Ranging";
  }

  public static getRegimeCategory(context: StrategyContext): "TRENDING" | "RANGING" | "BREAKOUT" | "LIQUIDITY_SWEEP" | "ACCUMULATION" | "DISTRIBUTION" {
    // 1. Check if a liquidity sweep has occurred on the latest closed candle
    const { candles, structure } = context;
    if (candles.length > 0 && structure?.sweeps) {
      const lastIdx = candles.length - 1;
      const currentSweep = structure.sweeps[lastIdx];
      if (currentSweep && (currentSweep.lowSwept || currentSweep.highSwept)) {
        return "LIQUIDITY_SWEEP";
      }
    }

    const classification = this.classify(context);
    if (classification === "Bullish Trend" || classification === "Bearish Trend") {
      return "TRENDING";
    }
    if (classification === "Breakout") {
      return "BREAKOUT";
    }
    if (classification === "Accumulation") {
      return "ACCUMULATION";
    }
    if (classification === "Distribution") {
      return "DISTRIBUTION";
    }
    return "RANGING";
  }
}
