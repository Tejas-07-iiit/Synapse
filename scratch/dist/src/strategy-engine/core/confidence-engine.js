import { TradingMode } from "../types";
import { RegimeEngine } from "./regime-engine";
import { PerformanceWeightingEngine } from "./performance-weighting";
import { strategyRegistry } from "./registry";
export class ConfidenceEngine {
    /**
     * Calculates a detailed component breakdown of the confidence score (0 to 100) for a given trade setup.
     */
    static calculateDetailed(direction, context, strategyId) {
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
        }
        else if (estRr < 1.5) {
            rrScore = -5;
        }
        score += rrScore;
        // 2. Market Regime Compatibility Match (Max +20, Min -10)
        let regimeScore = 0;
        const regime = RegimeEngine.classify(context);
        // Check compatibility based on strategy ID or indicators used
        const isTrendingStrat = strategyId && (strategyId.includes("cross") ||
            strategyId.includes("trend") ||
            strategyId.includes("supertrend") ||
            strategyId.includes("cloud") ||
            strategyId.includes("defensive") ||
            strategyId.includes("momentum"));
        const isMeanReversionStrat = strategyId && (strategyId.includes("reversion") ||
            strategyId.includes("reversal") ||
            strategyId.includes("grid"));
        const isBreakoutStrat = strategyId && strategyId.includes("breakout");
        if (regime === "TRENDING") {
            if (isTrendingStrat)
                regimeScore = 20;
            else if (isMeanReversionStrat)
                regimeScore = -10;
            else
                regimeScore = 5;
        }
        else if (regime === "RANGING") {
            if (isMeanReversionStrat)
                regimeScore = 20;
            else if (isTrendingStrat)
                regimeScore = -10;
            else
                regimeScore = 5;
        }
        else if (regime === "HIGH_VOLATILITY") {
            if (isBreakoutStrat)
                regimeScore = 20;
            else if (isTrendingStrat)
                regimeScore = 10;
            else
                regimeScore = 5;
        }
        else if (regime === "LOW_VOLATILITY") {
            if (isMeanReversionStrat)
                regimeScore = 20;
            else if (isBreakoutStrat)
                regimeScore = -10;
            else
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
            }
            else if (volume > volumeMA) {
                volumeScore = 8;
            }
        }
        score += volumeScore;
        // 4. Trend Strength (ADX/EMA Slope) (Max +10)
        let confirmScore = 0;
        const adx = indicators.adx?.[lastIdx] ?? 0;
        if (isTrendingStrat || isBreakoutStrat) {
            if (adx > 25)
                confirmScore += 10;
            else if (adx > 20)
                confirmScore += 5;
        }
        else if (isMeanReversionStrat) {
            if (adx < 20)
                confirmScore += 10;
            else if (adx < 25)
                confirmScore += 5;
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
        }
        else if (isMeanReversionStrat && !isExpanding) {
            volScore = 10;
        }
        score += volScore;
        // 6. Strategy Performance Boost (from weighting engine)
        let perfBoost = 0;
        if (strategyId) {
            perfBoost = PerformanceWeightingEngine.getStrategyBoost(strategyId);
            score += perfBoost;
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
    static calculate(direction, context, strategyId) {
        return this.calculateDetailed(direction, context, strategyId).finalScore;
    }
}
