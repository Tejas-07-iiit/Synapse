import { StrategyContext } from "../types";

export type MarketRegime =
  | "TRENDING"
  | "RANGING"
  | "HIGH_VOLATILITY"
  | "LOW_VOLATILITY"
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
   * Detects exactly: TRENDING, RANGING, HIGH_VOLATILITY, LOW_VOLATILITY.
   */
  public static classify(context: StrategyContext): MarketRegime {
    const { candles, indicators } = context;
    if (candles.length < 14) return "RANGING";

    const lastIdx = candles.length - 1;
    const price = candles[lastIdx].close;
    
    // 1. Calculate Bollinger Bands width and average width
    const bbUpper = indicators.bbUpper?.[lastIdx];
    const bbLower = indicators.bbLower?.[lastIdx];
    const bbMiddle = indicators.bbMiddle?.[lastIdx];
    
    let bbWidth = 0.05;
    let avgBbWidth = 0.05;
    if (bbUpper && bbLower && bbMiddle) {
      bbWidth = (bbUpper - bbLower) / bbMiddle;

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
      avgBbWidth = count > 0 ? widthSum / count : bbWidth;
    }

    // 2. Check EMA Slope over last 5 candles
    const ema20Last = indicators.ema20?.[lastIdx];
    const ema20Prev = indicators.ema20?.[Math.max(0, lastIdx - 5)] ?? ema20Last;
    const emaSlope = ema20Last ? (ema20Last - ema20Prev) / ema20Last : 0;

    // 3. Volume confirmation
    const volume = candles[lastIdx].volume;
    const volumeMA = indicators.volumeMA?.[lastIdx] ?? 0;
    const isVolumeExpanding = volumeMA > 0 && volume > volumeMA * 1.5;

    // 4. ADX and ATR
    const adx = indicators.adx?.[lastIdx] ?? 0;
    const atr = indicators.atr?.[lastIdx] ?? (price * 0.015);

    // Classification decision tree
    
    // A. Volatility Extremes: Low Volatility (Squeeze)
    if (bbWidth < avgBbWidth * 0.75) {
      return "LOW_VOLATILITY";
    }
    
    // B. Volatility Extremes: High Volatility (Expansion)
    if (bbWidth > avgBbWidth * 1.3 || (bbWidth > avgBbWidth * 1.15 && isVolumeExpanding)) {
      return "HIGH_VOLATILITY";
    }

    // C. Trending (Strong trend confirmed by ADX & EMA/SMA slope)
    const sma50 = indicators.sma50?.[lastIdx];
    if (adx > 25 && ema20Last && sma50) {
      if ((price > ema20Last && ema20Last > sma50 && emaSlope > 0.0002) || 
          (price < ema20Last && ema20Last < sma50 && emaSlope < -0.0002)) {
        return "TRENDING";
      }
    }

    // D. Default Sideways Ranging Channel
    return "RANGING";
  }

  public static getRegimeCategory(context: StrategyContext): "TRENDING" | "RANGING" | "BREAKOUT" | "LIQUIDITY_SWEEP" | "ACCUMULATION" | "DISTRIBUTION" | "HIGH_VOLATILITY" | "LOW_VOLATILITY" {
    const regime = this.classify(context);
    if (regime === "TRENDING") return "TRENDING";
    if (regime === "HIGH_VOLATILITY") return "BREAKOUT";
    if (regime === "LOW_VOLATILITY") return "RANGING";
    return "RANGING";
  }

  /**
   * Helper to check if a classified regime matches a list of supported regimes (with mapping support).
   */
  public static matches(classified: MarketRegime, supported: string[]): boolean {
    if (!supported || supported.length === 0) return true;

    const c = classified.toUpperCase();

    return supported.some(s => {
      const norm = s.toUpperCase().replace(/_/g, " ").trim();
      
      // 1. Direct or normalized match (e.g. "RANGING" === "RANGING" or "LOW_VOLATILITY" === "LOW_VOLATILITY")
      if (norm === c || norm.replace(/\s+/g, "_") === c) return true;

      // 2. Broad regime mappings
      if (c === "TRENDING" && (norm.includes("TREND") || norm.includes("TRENDING"))) return true;
      if (c === "RANGING" && (norm.includes("RANGE") || norm.includes("RANGING") || norm.includes("ACCUMULATION") || norm.includes("DISTRIBUTION"))) return true;
      if (c === "HIGH_VOLATILITY" && (norm.includes("VOLATIL") || norm.includes("BREAKOUT"))) return true;
      if (c === "LOW_VOLATILITY" && (norm.includes("VOLATIL") || norm.includes("SQUEEZE") || norm.includes("RANGING") || norm.includes("RANGE"))) return true;

      return false;
    });
  }
}
