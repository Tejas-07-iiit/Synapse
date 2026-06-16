import { StrategyContext, TradingMode } from "../types";
import { RegimeEngine } from "./regime-engine";
import { PerformanceWeightingEngine } from "./performance-weighting";
import { strategyRegistry } from "./registry";

export class ConfidenceEngine {
  /**
   * Calculates a detailed component breakdown of the confidence score (0 to 100) for a given trade setup.
   */
  public static calculateDetailed(
    direction: "LONG" | "SHORT" | "HOLD",
    context: StrategyContext,
    strategyId?: string
  ): {
    trendScore: number;
    momentumScore: number;
    volumeScore: number;
    regimeScore: number;
    confirmScore: number;
    perfBoost: number;
    finalScore: number;
  } {
    if (direction === "HOLD") {
      return { trendScore: 0, momentumScore: 0, volumeScore: 0, regimeScore: 0, confirmScore: 0, perfBoost: 0, finalScore: 0 };
    }

    const { candles, indicators } = context;
    if (candles.length === 0) {
      return { trendScore: 0, momentumScore: 0, volumeScore: 0, regimeScore: 0, confirmScore: 0, perfBoost: 0, finalScore: 50 };
    }

    const lastIdx = candles.length - 1;
    const price = candles[lastIdx].close;

    // 1. Get Strategy Meta and Real Performance Stats
    const strategy = strategyId ? strategyRegistry.getStrategy(strategyId) : undefined;
    const stratCategory = strategy?.category || TradingMode.INTRADAY;
    const stats = strategyId ? PerformanceWeightingEngine.getStats(strategyId) : null;
    
    const winRate = stats ? stats.winRate : 0.50;
    const profitFactor = stats ? stats.profitFactor : 1.0;

    let score = 40; // Base score (neutral setup)

    // A. Win Rate Impact (Max +20, Min -15)
    const winRateScore = Math.min(20, Math.max(-15, Math.round((winRate - 0.50) * 100)));
    score += winRateScore;

    // B. Profit Factor Impact (Max +15, Min -15)
    const profitFactorScore = Math.min(15, Math.max(-15, Math.round((profitFactor - 1.0) * 20)));
    score += profitFactorScore;

    // C. Risk/Reward Profile (Max +10, Min -5)
    // Estimate R/R: Scalping targets 1.5, Intraday targets 2.0
    const estRr = stratCategory === TradingMode.SCALPING ? 1.5 : 2.0;
    let rrScore = 5;
    if (estRr >= 2.0) {
      rrScore = 10;
    } else if (estRr < 1.5) {
      rrScore = -5;
    }
    score += rrScore;

    // 2. Market Regime Compatibility Match (Max +20, Min -10)
    let regimeScore = 0;
    const rawRegime = RegimeEngine.classify(context);
    const regime = rawRegime.toUpperCase();
    
    // Determine strategy type from supportedRegimes in registry (preferred), then fallback to ID keywords
    let isTrendingStrat = false;
    let isMeanReversionStrat = false;
    let isBreakoutStrat = false;

    if (strategy && strategy.supportedRegimes) {
      const sr = strategy.supportedRegimes.map(s => s.toUpperCase());
      const supportsTrending = sr.includes("TRENDING") || sr.includes("WEAK_TRENDING");
      const supportsRanging = sr.includes("RANGING");
      const supportsBreakout = sr.includes("BREAKOUT") || sr.includes("HIGH_VOLATILITY");

      // A strategy that supports TRENDING is trend-following unless it ONLY supports ranging
      if (supportsTrending && !supportsBreakout) {
        isTrendingStrat = true;
      } else if (supportsRanging && !supportsTrending && !supportsBreakout) {
        isMeanReversionStrat = true;
      } else if (supportsBreakout) {
        isBreakoutStrat = true;
      } else {
        // Mixed support — treat as trending if it supports trending
        isTrendingStrat = supportsTrending;
        isMeanReversionStrat = !supportsTrending && supportsRanging;
      }
    } else if (strategyId) {
      // Fallback: ID keyword matching (order matters — check trending first)
      isBreakoutStrat = strategyId.includes("breakout");
      if (!isBreakoutStrat) {
        isTrendingStrat = (
          strategyId.includes("cross") || 
          strategyId.includes("trend") || 
          strategyId.includes("supertrend") || 
          strategyId.includes("cloud") ||
          strategyId.includes("defensive") ||
          strategyId.includes("momentum") ||
          strategyId.includes("dow")
        );
        // Only classify as mean reversion if NOT already a trending strategy
        isMeanReversionStrat = !isTrendingStrat && (
          strategyId.includes("reversion") || 
          strategyId.includes("reversal") || 
          strategyId.includes("grid")
        );
      }
    }

    const isTrendRegime = regime.includes("TREND") || regime.includes("BREAKOUT");
    const isRangeRegime = regime.includes("RANGE") || regime.includes("VOLATILITY") || regime.includes("ACCUMULATION") || regime.includes("DISTRIBUTION");

    if (isTrendRegime) {
      if (isTrendingStrat) regimeScore = 20;
      else if (isMeanReversionStrat) regimeScore = -10;
      else regimeScore = 10;
    } else if (regime === "WEAK_TRENDING") {
      if (isTrendingStrat) regimeScore = 15;
      else if (isMeanReversionStrat) regimeScore = -5;
      else regimeScore = 5;
    } else if (isRangeRegime) {
      if (isMeanReversionStrat) regimeScore = 20;
      else if (isTrendingStrat) regimeScore = -10;
      else regimeScore = 10;
    } else {
      regimeScore = 5;
    }
    score += regimeScore;

    // 3. Volume Confirmation (Max +15)
    let volumeScore = 0;
    const volume = candles[lastIdx].volume;
    const volumeMA = indicators.volumeMA?.[lastIdx] ?? 0;
    if (volumeMA > 0) {
      if (volume > volumeMA * 1.5) {
        volumeScore = 15;
      } else if (volume > volumeMA) {
        volumeScore = 8;
      }
    }
    score += volumeScore;

    // 4. Trend Strength (ADX/EMA Slope) (Max +10)
    let confirmScore = 0;
    const adx = indicators.adx?.[lastIdx] ?? 0;
    if (isTrendingStrat || isBreakoutStrat) {
      if (adx > 25) confirmScore += 10;
      else if (adx > 20) confirmScore += 5;
    } else if (isMeanReversionStrat) {
      if (adx < 20) confirmScore += 10;
      else if (adx < 25) confirmScore += 5;
    }
    score += confirmScore;

    // 5. Volatility Alignment (ATR / BB width) (Max +10)
    let volScore = 0;
    const bbUpper = indicators.bbUpper?.[lastIdx] ?? 0;
    const bbLower = indicators.bbLower?.[lastIdx] ?? 0;
    const bbMiddle = indicators.bbMiddle?.[lastIdx] ?? 1;
    const bbWidth = (bbUpper - bbLower) / bbMiddle;
    
    // Check if BB is expanding vs contracting
    const prevBbUpper = lastIdx > 0 ? (indicators.bbUpper?.[lastIdx - 1] ?? bbUpper) : bbUpper;
    const prevBbLower = lastIdx > 0 ? (indicators.bbLower?.[lastIdx - 1] ?? bbLower) : bbLower;
    const prevBbMiddle = lastIdx > 0 ? (indicators.bbMiddle?.[lastIdx - 1] ?? bbMiddle) : bbMiddle;
    const prevBbWidth = (prevBbUpper - prevBbLower) / prevBbMiddle;
    const isExpanding = bbWidth > prevBbWidth;

    if (isBreakoutStrat && isExpanding) {
      volScore = 10;
    } else if (isMeanReversionStrat && !isExpanding) {
      volScore = 10;
    }
    score += volScore;

    // 6. Strategy Performance Boost (from weighting engine)
    let perfBoost = 0;
    if (strategyId) {
      perfBoost = PerformanceWeightingEngine.getStrategyBoost(strategyId);
      score += perfBoost;
    }

    // 7. Scalping Sensitivity Boost (+10)
    // Scalping trades happen in fast markets where indicators might not hit "Extreme" levels.
    if (stratCategory === TradingMode.SCALPING) {
      score += 10;
    }

    const finalScore = Math.min(100, Math.max(0, score));

    return {
      trendScore: winRateScore,
      momentumScore: profitFactorScore,
      volumeScore,
      regimeScore,
      confirmScore: confirmScore + volScore,
      perfBoost,
      finalScore
    };
  }

  /**
   * Calculates a centralized confidence score (0 to 100) for a given trade setup.
   */
  public static calculate(
    direction: "LONG" | "SHORT" | "HOLD",
    context: StrategyContext,
    strategyId?: string
  ): number {
    return this.calculateDetailed(direction, context, strategyId).finalScore;
  }
}
