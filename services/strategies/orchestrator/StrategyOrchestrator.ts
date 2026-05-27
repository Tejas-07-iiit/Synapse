import { strategyRegistry } from "../registry/StrategyRegistry";
import { EMACrossoverStrategy, RSIMomentumStrategy } from "../registry/templates";
import { StrategyContext, StrategySignal } from "../interfaces";
import { useStrategyStore } from "@/store/strategy/useStrategyStore";

// Initialize and register templates immediately
strategyRegistry.register(new EMACrossoverStrategy());
strategyRegistry.register(new RSIMomentumStrategy());

export class StrategyOrchestrator {
  /**
   * Orchestrates the strategy run for a given market context.
   * Runs all registered strategies matching the timeframe, validates their signals,
   * stores them in the strategy Zustand store, and returns the generated signals array.
   */
  public static run(context: StrategyContext): StrategySignal[] {
    const activeStrategies = strategyRegistry.getStrategies();
    const generatedSignals: StrategySignal[] = [];

    for (const strategy of activeStrategies) {
      // 1. Verify if strategy supports current timeframe
      if (!strategy.supportedTimeframes.includes(context.timeframe)) {
        continue;
      }

      try {
        // 2. Run analysis
        const signal = strategy.analyze(context);

        // 3. Validate the signal contract
        if (strategy.validate(signal)) {
          generatedSignals.push(signal);
          
          // 4. Update the Zustand strategy store
          useStrategyStore.getState().addSignal(signal as any);
        }
      } catch (err) {
        console.error(`[Orchestrator] Failed executing strategy "${strategy.name}":`, err);
      }
    }

    return generatedSignals;
  }
}
