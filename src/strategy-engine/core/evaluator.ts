import { StrategySignal } from "../types";

export class StrategyEvaluator {
  /**
   * Resolves conflicts when multiple strategies trigger opposite signals for the same symbol.
   * If a conflict exists (e.g. LONG and SHORT), compares average confidence.
   * If confidence difference is small, suppresses both into a HOLD.
   */
  public static resolveConflicts(signals: StrategySignal[]): StrategySignal[] {
    const grouped = new Map<string, StrategySignal[]>();

    // Group signals by symbol
    for (const signal of signals) {
      const list = grouped.get(signal.symbol) || [];
      list.push(signal);
      grouped.set(signal.symbol, list);
    }

    const resolved: StrategySignal[] = [];

    for (const [symbol, symSignals] of grouped.entries()) {
      const longs = symSignals.filter((s) => s.signal === "LONG");
      const shorts = symSignals.filter((s) => s.signal === "SHORT");

      // No conflict if there are no opposite signals
      if (longs.length === 0 || shorts.length === 0) {
        resolved.push(...symSignals);
        continue;
      }

      // Conflict exists: calculate average confidence for each side
      const avgLongConf = longs.reduce((sum, s) => sum + s.confidence, 0) / longs.length;
      const avgShortConf = shorts.reduce((sum, s) => sum + s.confidence, 0) / shorts.length;

      const CONFIDENCE_THRESHOLD_DIFF = 15; // Must beat other side by 15% to resolve

      if (Math.abs(avgLongConf - avgShortConf) < CONFIDENCE_THRESHOLD_DIFF) {
        // Opposing signals are too close in strength; neutralize them by generating a HOLD signal
        const consensusTimestamp = symSignals[0]?.timestamp || Date.now();
        const consensusTimeframe = symSignals[0]?.timeframe || "15m";
        
        resolved.push({
          signal: "HOLD",
          signalType: "HOLD",
          strategyName: "Consensus Evaluator",
          confidence: Math.round((avgLongConf + avgShortConf) / 2),
          entry: symSignals[0].entry,
          stopLoss: 0,
          takeProfit: 0,
          symbol,
          timeframe: consensusTimeframe,
          timestamp: consensusTimestamp,
          reasoning: [
            `Conflict neutralized: ${longs.length} LONG strategy setups (${avgLongConf.toFixed(0)}% conf) conflicted with ${shorts.length} SHORT setups (${avgShortConf.toFixed(0)}% conf).`
          ],
          indicators: symSignals[0].indicators,
          strategyId: "consensus-evaluator",
        });

        // Log suppressed/neutralized signal information
        console.log(`[Evaluator] Neutralized conflict on ${symbol}: LONG vs SHORT`);
      } else if (avgLongConf > avgShortConf) {
        // LONG wins: keep long signals, filter out shorts
        resolved.push(...longs);
        console.log(`[Evaluator] Resolved conflict on ${symbol} in favor of LONG (Confidence delta: ${(avgLongConf - avgShortConf).toFixed(0)}%)`);
      } else {
        // SHORT wins: keep short signals, filter out longs
        resolved.push(...shorts);
        console.log(`[Evaluator] Resolved conflict on ${symbol} in favor of SHORT (Confidence delta: ${(avgShortConf - avgLongConf).toFixed(0)}%)`);
      }
    }

    return resolved;
  }
}
