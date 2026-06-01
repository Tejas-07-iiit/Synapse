import { StrategyContext } from "../types";
import { RegimeEngine } from "./regime-engine";
import { PerformanceWeightingEngine } from "./performance-weighting";

const STRATEGY_CATEGORIES: Record<string, string> = {
  "ema-crossover": "Trend Following",
  "rsi-reversal": "Reversal",
  "macd-momentum": "Momentum",
  "bollinger-breakout": "Breakout",
  "mean-reversion": "Mean-Reversion",
  "momentum": "Momentum",
  "defensive": "Defensive",
  "grid": "Grid",
  "lorentzian": "Lorentzian",
  "donchian-breakout": "Breakout",
  "rally-base-drop": "SupplyDemand",
  "sr-sweep": "LiquiditySweep",
  "bollinger-reversion": "MeanReversion",
  "short-term-reversal": "Reversal",
  "dow-mfi-rsi": "Momentum",
  "parabolic-rsi": "Momentum",
  "range-breakout-high": "Breakout",
  "residual-momentum": "Momentum",
  "time-series-momentum": "Momentum",
  "wavetrend": "Momentum",
  "hash-ribbons": "Sentiment",
  "news-fear-greed": "Sentiment",
  "ema-cross-adx": "Trend Following",
  "golden-cross": "Trend Following",
  "heiken-ashi-swing": "Trend Following",
  "hyper-supertrend": "Trend Following",
  "ichimoku-cloud": "Trend Following",
  "ma-crossover-var": "Trend Following",
  "sma-trend-filter": "Trend Following",
  "t3-nexus": "Trend Following",
  "squeeze-momentum": "Volatility",
  "volatility-regime": "Volatility",
  "zeiierman-volatility": "Volatility",
};

export class ConfidenceEngine {
  /**
   * Calculates a centralized confidence score (0 to 100) for a given trade setup.
   */
  public static calculate(
    direction: "LONG" | "SHORT" | "HOLD",
    context: StrategyContext,
    strategyId?: string
  ): number {
    if (direction === "HOLD") return 0;

    const { candles, indicators } = context;
    if (candles.length === 0) return 50;

    const lastIdx = candles.length - 1;
    const price = candles[lastIdx].close;

    let score = 0;

    // 1. Trend Alignment (Max 25 pts)
    let trendScore = 0;
    const ema20 = indicators.ema20?.[lastIdx];
    const sma50 = indicators.sma50?.[lastIdx];
    if (ema20 && sma50) {
      if (direction === "LONG") {
        if (price > ema20 && ema20 > sma50) {
          trendScore = 25; // Perfect trend alignment
        } else if (price > ema20 || ema20 > sma50) {
          trendScore = 12; // Partial alignment
        }
      } else if (direction === "SHORT") {
        if (price < ema20 && ema20 < sma50) {
          trendScore = 25; // Perfect trend alignment
        } else if (price < ema20 || ema20 < sma50) {
          trendScore = 12; // Partial alignment
        }
      }
    }
    score += trendScore;

    // 2. Momentum Alignment (Max 20 pts)
    let momentumScore = 0;
    const macdHist = indicators.macdHist?.[lastIdx] ?? 0;
    const rsi = indicators.rsi?.[lastIdx] ?? 50;
    const rsiPrev = lastIdx > 0 ? (indicators.rsi?.[lastIdx - 1] ?? 50) : 50;

    if (direction === "LONG") {
      if (macdHist > 0) momentumScore += 10;
      if (rsi > rsiPrev) momentumScore += 10;
    } else if (direction === "SHORT") {
      if (macdHist < 0) momentumScore += 10;
      if (rsi < rsiPrev) momentumScore += 10;
    }
    score += momentumScore;

    // 3. Volume Confirmation (Max 15 pts)
    let volumeScore = 0;
    const volume = candles[lastIdx].volume;
    const volumeMA = indicators.volumeMA?.[lastIdx] ?? 0;
    if (volumeMA > 0) {
      if (volume > volumeMA * 1.5) {
        volumeScore = 15; // Strong volume expansion
      } else if (volume > volumeMA) {
        volumeScore = 8;  // Moderate volume expansion
      }
    }
    score += volumeScore;

    // 4. Regime Match (Max 20 pts)
    let regimeScore = 0;
    const regimeCategory = RegimeEngine.getRegimeCategory(context);
    const category = strategyId ? (STRATEGY_CATEGORIES[strategyId] || "Central Engine") : "Central Engine";

    const isTrendingStrat = category === "Trend Following" || category === "Sentiment" || category === "Defensive";
    const isMeanReversionStrat = category === "Reversal" || category === "Mean-Reversion" || category === "MeanReversion" || category === "Grid";
    const isBreakoutStrat = category === "Breakout" || category === "Volatility";
    const isSweepStrat = category === "LiquiditySweep" || category === "SupplyDemand";

    if (regimeCategory === "TRENDING") {
      if (isTrendingStrat) regimeScore = 20;
      else if (category === "Lorentzian") regimeScore = 10;
    } else if (regimeCategory === "RANGING" || regimeCategory === "ACCUMULATION" || regimeCategory === "DISTRIBUTION") {
      if (isMeanReversionStrat) regimeScore = 20;
      else if (category === "Lorentzian" || isTrendingStrat) regimeScore = 10;
    } else if (regimeCategory === "BREAKOUT") {
      if (isBreakoutStrat) regimeScore = 20;
      else if (category === "Lorentzian") regimeScore = 10;
    } else if (regimeCategory === "LIQUIDITY_SWEEP") {
      if (isSweepStrat) regimeScore = 20;
      else if (category === "Lorentzian") regimeScore = 10;
    }
    score += regimeScore;

    // 5. Confirmation Indicators (Max 20 pts)
    let confirmScore = 0;
    const stochRsiK = indicators.stochRsiK?.[lastIdx];
    const stochRsiD = indicators.stochRsiD?.[lastIdx];
    const adx = indicators.adx?.[lastIdx] ?? 0;

    const isTrendOrBreakout = isTrendingStrat || isBreakoutStrat;
    const isRangeOrReversion = isMeanReversionStrat || isSweepStrat;

    if (direction === "LONG") {
      // Stochastic RSI confirmation
      if (stochRsiK !== undefined && stochRsiD !== undefined) {
        if (stochRsiK > stochRsiD || stochRsiK < 20) {
          confirmScore += 10;
        }
      } else {
        confirmScore += 5; // Default fallback points
      }
      // ADX alignment
      if (isTrendOrBreakout && adx > 25) {
        confirmScore += 10;
      } else if (isRangeOrReversion && adx < 20) {
        confirmScore += 10;
      } else if (adx >= 20 && adx <= 25) {
        confirmScore += 5;
      }
    } else if (direction === "SHORT") {
      // Stochastic RSI confirmation
      if (stochRsiK !== undefined && stochRsiD !== undefined) {
        if (stochRsiK < stochRsiD || stochRsiK > 80) {
          confirmScore += 10;
        }
      } else {
        confirmScore += 5;
      }
      // ADX alignment
      if (isTrendOrBreakout && adx > 25) {
        confirmScore += 10;
      } else if (isRangeOrReversion && adx < 20) {
        confirmScore += 10;
      } else if (adx >= 20 && adx <= 25) {
        confirmScore += 5;
      }
    }
    score += confirmScore;

    let finalScore = Math.round(score);
    let perfBoost = 0;

    // 6. Performance Weighting Adjustments
    if (strategyId) {
      perfBoost = PerformanceWeightingEngine.getStrategyBoost(strategyId);
      finalScore += perfBoost;
    }

    finalScore = Math.min(100, Math.max(0, finalScore));

    return finalScore;
  }
}
