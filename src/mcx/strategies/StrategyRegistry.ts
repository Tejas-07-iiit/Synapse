import { MomentumStrategy } from "./examples/MomentumStrategy";
import type { MCXStrategy } from "./sdk/Strategy";

export class StrategyRegistry {
  private static strategies: MCXStrategy[] = [new MomentumStrategy()];

  static all() {
    return this.strategies;
  }

  static register(strategy: MCXStrategy) {
    this.strategies = this.strategies.filter((existing) => existing.id !== strategy.id).concat(strategy);
  }
}
