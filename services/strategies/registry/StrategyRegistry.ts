import { Strategy } from "../interfaces";

class StrategyRegistry {
  private strategies: Map<string, Strategy> = new Map();

  public register(strategy: Strategy): void {
    if (this.strategies.has(strategy.id)) {
      console.warn(`Strategy with ID "${strategy.id}" is already registered. Overwriting.`);
    }
    this.strategies.set(strategy.id, strategy);
    console.log(`Registered strategy: ${strategy.name} [ID: ${strategy.id}]`);
  }

  public unregister(id: string): void {
    if (this.strategies.has(id)) {
      this.strategies.delete(id);
      console.log(`Unregistered strategy ID: ${id}`);
    }
  }

  public getStrategies(): Strategy[] {
    return Array.from(this.strategies.values());
  }

  public getStrategy(id: string): Strategy | undefined {
    return this.strategies.get(id);
  }

  public clear(): void {
    this.strategies.clear();
  }
}

export const strategyRegistry = new StrategyRegistry();
