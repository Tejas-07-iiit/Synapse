import { TradingStrategy, StrategyContext, StrategySignal } from "../types";

export class StrategyRunner {
  /**
   * Safely executes a single strategy with performance timing.
   */
  public static run(
    strategy: TradingStrategy,
    context: StrategyContext
  ): { signal: StrategySignal | null; latencyMs: number } {
    const startTime = Date.now();
    try {
      // Execute evaluation
      const signal = strategy.evaluate(context);
      const latencyMs = Date.now() - startTime;
      
      return {
        signal,
        latencyMs,
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      console.error(`[StrategyRunner] Failed to execute strategy ${strategy.id}:`, error);
      return {
        signal: null,
        latencyMs,
      };
    }
  }
}
