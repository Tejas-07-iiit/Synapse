import { TradingStrategy, StrategyContext, StrategySignal } from "../types";

class StrategyRegistry {
  private strategies: Map<string, TradingStrategy> = new Map();
  private lastSignals: StrategySignal[] = [];

  public registerStrategy(strategy: TradingStrategy): void {
    if (this.strategies.has(strategy.id)) {
      console.warn(`Strategy with ID "${strategy.id}" is already registered. Overwriting.`);
    }
    this.strategies.set(strategy.id, strategy);
    console.log(`[Registry] Registered strategy: ${strategy.name} [ID: ${strategy.id}]`);
    
    // Sync strategy to database (non-blocking server-side check)
    if (typeof window === "undefined") {
      import("@/lib/prisma").then(({ default: prisma }) => {
        prisma.strategy.upsert({
          where: { id: strategy.id },
          update: { name: strategy.name, description: strategy.description },
          create: { id: strategy.id, name: strategy.name, description: strategy.description, enabled: strategy.enabled },
        }).catch(() => {});
      });
    }
  }

  public unregisterStrategy(id: string): void {
    if (this.strategies.has(id)) {
      const strategy = this.strategies.get(id);
      this.strategies.delete(id);
      console.log(`[Registry] Unregistered strategy: ${strategy?.name} [ID: ${id}]`);
    }
  }

  public enableStrategy(id: string): void {
    const strategy = this.strategies.get(id);
    if (strategy) {
      strategy.enabled = true;
      console.log(`[Registry] Enabled strategy: ${strategy.name}`);
      if (typeof window === "undefined") {
        import("@/lib/prisma").then(({ default: prisma }) => {
          prisma.strategy.update({
            where: { id },
            data: { enabled: true },
          }).catch(() => {});
        });
      }
    }
  }

  public disableStrategy(id: string): void {
    const strategy = this.strategies.get(id);
    if (strategy) {
      strategy.enabled = false;
      console.log(`[Registry] Disabled strategy: ${strategy.name}`);
      if (typeof window === "undefined") {
        import("@/lib/prisma").then(({ default: prisma }) => {
          prisma.strategy.update({
            where: { id },
            data: { enabled: false },
          }).catch(() => {});
        });
      }
    }
  }

  public getStrategies(): TradingStrategy[] {
    return Array.from(this.strategies.values());
  }

  public getStrategy(id: string): TradingStrategy | undefined {
    return this.strategies.get(id);
  }

  public runStrategies(context: StrategyContext): StrategySignal[] {
    const signals: StrategySignal[] = [];
    for (const strategy of this.strategies.values()) {
      const activeSymbols = strategy.symbols || [];
      const activeTimeframes = strategy.timeframes || [];
      if (
        (activeSymbols.includes(context.symbol) || activeSymbols.length === 0) &&
        (activeTimeframes.includes(context.timeframe) || activeTimeframes.length === 0)
      ) {
        try {
          const sig = strategy.evaluate(context);
          signals.push(sig);
        } catch (error) {
          console.error(`[Registry] Error evaluating strategy ${strategy.id}:`, error);
        }
      }
    }
    this.lastSignals = signals;
    return signals;
  }

  public runStrategiesForSymbol(symbol: string, context: StrategyContext): StrategySignal[] {
    const signals: StrategySignal[] = [];
    for (const strategy of this.strategies.values()) {
      const activeSymbols = strategy.symbols || [];
      const activeTimeframes = strategy.timeframes || [];
      if (
        (activeSymbols.includes(symbol) || activeSymbols.length === 0) &&
        (activeTimeframes.includes(context.timeframe) || activeTimeframes.length === 0)
      ) {
        try {
          const sig = strategy.evaluate(context);
          signals.push(sig);
        } catch (error) {
          console.error(`[Registry] Error evaluating strategy ${strategy.id} for symbol ${symbol}:`, error);
        }
      }
    }
    return signals;
  }

  public runStrategiesForTimeframe(timeframe: string, context: StrategyContext): StrategySignal[] {
    const signals: StrategySignal[] = [];
    for (const strategy of this.strategies.values()) {
      const activeSymbols = strategy.symbols || [];
      const activeTimeframes = strategy.timeframes || [];
      if (
        (activeSymbols.includes(context.symbol) || activeSymbols.length === 0) &&
        (activeTimeframes.includes(timeframe) || activeTimeframes.length === 0)
      ) {
        try {
          const sig = strategy.evaluate(context);
          signals.push(sig);
        } catch (error) {
          console.error(`[Registry] Error evaluating strategy ${strategy.id} for timeframe ${timeframe}:`, error);
        }
      }
    }
    return signals;
  }

  public getActiveSignals(): StrategySignal[] {
    return this.lastSignals;
  }

  public clear(): void {
    this.strategies.clear();
    this.lastSignals = [];
  }
}

export const strategyRegistry = new StrategyRegistry();

// Export the expected methods directly as functions for ease of import
export const registerStrategy = (strategy: TradingStrategy) => strategyRegistry.registerStrategy(strategy);
export const unregisterStrategy = (id: string) => strategyRegistry.unregisterStrategy(id);
export const enableStrategy = (id: string) => strategyRegistry.enableStrategy(id);
export const disableStrategy = (id: string) => strategyRegistry.disableStrategy(id);
export const runStrategies = (context: StrategyContext) => strategyRegistry.runStrategies(context);
export const runStrategiesForSymbol = (symbol: string, context: StrategyContext) => strategyRegistry.runStrategiesForSymbol(symbol, context);
export const runStrategiesForTimeframe = (timeframe: string, context: StrategyContext) => strategyRegistry.runStrategiesForTimeframe(timeframe, context);
export const getActiveSignals = () => strategyRegistry.getActiveSignals();
