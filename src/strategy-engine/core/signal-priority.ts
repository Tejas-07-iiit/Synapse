import { StrategySignal } from "../types";
import { StrategyEvaluator } from "./evaluator";

export class SignalPriorityEngine {
  private static readonly CONFIDENCE_THRESHOLD = 75; // Suppress signals with confidence lower than 75%

  /**
   * Processes, ranks, suppresses, and resolves conflicts among signals.
   * Keeps only the highest quality setups.
   */
  public static prioritize(signals: StrategySignal[]): StrategySignal[] {
    // 1. Suppress weak setups and HOLD signals
    const activeSetups = signals.filter(
      (sig) => sig.signal !== "HOLD" && sig.confidence >= this.CONFIDENCE_THRESHOLD
    );

    // 2. Resolve LONG/SHORT conflicts per symbol
    const resolvedSetups = StrategyEvaluator.resolveConflicts(activeSetups);

    // 3. Rank signals by confidence (highest first)
    resolvedSetups.sort((a, b) => b.confidence - a.confidence);

    // 4. Prevent duplicates: If a strategy generated multiple signals for the same symbol, keep the strongest
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
