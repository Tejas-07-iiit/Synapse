import { StrategySignal } from "../types";
import { StrategyEvaluator } from "./evaluator";
import { PerformanceWeightingEngine } from "./performance-weighting";
import { AuditLogger } from "../../lib/audit/trading-audit";

export class SignalPriorityEngine {
  private static readonly CONFIDENCE_THRESHOLD = 60; // Minimum raw confidence to avoid weak signals
  private static readonly FINAL_SCORE_THRESHOLD = 75; // Minimum final score (with performance/regime/volume boosts)

  /**
   * Processes, ranks, suppresses, and resolves conflicts among signals.
   * Keeps only the highest quality setups.
   */
  public static prioritize(signals: StrategySignal[]): StrategySignal[] {
    // 1. Phase 6: Enforce Market Regime Filter
    for (const sig of signals) {
      if (sig.signal === "HOLD") continue;

      const regime = sig.marketContext?.regimeCategory || "RANGING";
      const category = sig.strategyCategory || "Central Engine";

      const isTrendingStrat = category === "Trend Following" || category === "Sentiment" || category === "Defensive";
      const isMeanReversionStrat = category === "Reversal" || category === "Mean-Reversion" || category === "MeanReversion" || category === "Grid";
      const isBreakoutStrat = category === "Breakout" || category === "Volatility";
      const isSweepStrat = category === "LiquiditySweep" || category === "SupplyDemand";

      let compatible = false;
      if (regime === "TRENDING") {
        compatible = isTrendingStrat || category === "Lorentzian";
      } else if (regime === "RANGING" || regime === "ACCUMULATION" || regime === "DISTRIBUTION") {
        compatible = isMeanReversionStrat || category === "Lorentzian" || isTrendingStrat;
      } else if (regime === "BREAKOUT") {
        compatible = isBreakoutStrat || category === "Lorentzian";
      } else if (regime === "LIQUIDITY_SWEEP") {
        compatible = isSweepStrat || category === "Lorentzian";
      }

      if (!compatible) {
        sig.signal = "HOLD";
        sig.signalType = "HOLD";
        sig.confidence = 0;
        sig.blocked = true;
        sig.blockReason = `Regime mismatch: ${category} strategy not allowed in ${regime} regime.`;
        AuditLogger.logSignalRejected({
          strategyId: sig.strategyId,
          strategyName: sig.strategyName,
          symbol: sig.symbol,
          timeframe: sig.timeframe,
          confidence: sig.confidence,
          reason: sig.blockReason
        });
      }
    }

    // 2. Phase 7: Calculate Final Score & Filter by Thresholds
    const activeSetups: StrategySignal[] = [];

    for (const sig of signals) {
      if (sig.signal === "HOLD") continue;
      
      if (sig.confidence < this.CONFIDENCE_THRESHOLD) {
        AuditLogger.logConfidenceRejected({
          strategyId: sig.strategyId,
          strategyName: sig.strategyName,
          symbol: sig.symbol,
          confidence: sig.confidence,
          threshold: this.CONFIDENCE_THRESHOLD
        });
        continue;
      }

      // A. Performance Boost
      const boost = PerformanceWeightingEngine.getStrategyBoost(sig.strategyId);

      // B. Regime Compatibility Bonus
      const regime = sig.marketContext?.regimeCategory || "RANGING";
      const category = sig.strategyCategory || "Central Engine";
      let regimeMatchBonus = 0;

      const isTrendingStrat = category === "Trend Following" || category === "Sentiment" || category === "Defensive";
      const isMeanReversionStrat = category === "Reversal" || category === "Mean-Reversion" || category === "MeanReversion" || category === "Grid";
      const isBreakoutStrat = category === "Breakout" || category === "Volatility";
      const isSweepStrat = category === "LiquiditySweep" || category === "SupplyDemand";

      if (regime === "TRENDING" && isTrendingStrat) regimeMatchBonus = 10;
      else if ((regime === "RANGING" || regime === "ACCUMULATION" || regime === "DISTRIBUTION") && isMeanReversionStrat) regimeMatchBonus = 10;
      else if (regime === "BREAKOUT" && isBreakoutStrat) regimeMatchBonus = 10;
      else if (regime === "LIQUIDITY_SWEEP" && isSweepStrat) regimeMatchBonus = 10;
      else if (category === "Lorentzian" || isTrendingStrat) regimeMatchBonus = 5; // Partial compatibility

      // C. Volume Confirmation Bonus
      let volumeConfirmationBonus = 0;
      const volume = sig.indicators?.volume ?? 0;
      const volumeMA = sig.indicators?.volumeMA ?? 0;
      if (volumeMA > 0 && volume > volumeMA * 1.5) {
        volumeConfirmationBonus = 10;
      }

      const finalScore = sig.confidence + boost + regimeMatchBonus + volumeConfirmationBonus;
      (sig as any).finalScore = Math.min(100, Math.max(0, Math.round(finalScore)));

      if ((sig as any).finalScore >= this.FINAL_SCORE_THRESHOLD) {
        activeSetups.push(sig);
      } else {
        AuditLogger.logConfidenceRejected({
          strategyId: sig.strategyId,
          strategyName: sig.strategyName,
          symbol: sig.symbol,
          confidence: (sig as any).finalScore,
          threshold: this.FINAL_SCORE_THRESHOLD
        });
      }
    }

    // 3. Resolve LONG/SHORT conflicts per symbol
    const resolvedSetups = StrategyEvaluator.resolveConflicts(activeSetups);

    // 4. Rank signals by Final Score (highest first)
    resolvedSetups.sort((a, b) => {
      const scoreA = (a as any).finalScore ?? a.confidence;
      const scoreB = (b as any).finalScore ?? b.confidence;
      return scoreB - scoreA;
    });

    // 5. Prevent duplicates: If a strategy generated multiple signals for the same symbol, keep the strongest
    const seen = new Set<string>();
    const uniqueSetups: StrategySignal[] = [];

    for (const setup of resolvedSetups) {
      const key = `${setup.symbol}_${setup.strategyId}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueSetups.push(setup);
      } 
    }

    return uniqueSetups;
  }
}
