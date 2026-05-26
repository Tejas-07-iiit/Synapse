import { Strategy, StrategyContext, StrategySignal } from "../interfaces";

export abstract class BaseStrategy implements Strategy {
  public abstract id: string;
  public abstract name: string;
  public abstract supportedTimeframes: string[];

  public abstract analyze(context: StrategyContext): StrategySignal;

  /**
   * Default signal validation logic.
   * Can be overridden by individual strategies if more complex constraints are needed.
   */
  public validate(signal: StrategySignal): boolean {
    // 1. Symbol must be defined
    if (!signal.symbol) {
      console.warn(`[Strategy: ${this.name}] Validation failed: Symbol is empty.`);
      return false;
    }

    // 2. Direction must be standard
    const validDirections = ["LONG", "SHORT", "HOLD"];
    if (!validDirections.includes(signal.direction)) {
      console.warn(`[Strategy: ${this.name}] Validation failed: Invalid direction "${signal.direction}".`);
      return false;
    }

    // 3. Confidence must be between 0 and 100
    if (signal.confidence < 0 || signal.confidence > 100) {
      console.warn(`[Strategy: ${this.name}] Validation failed: Confidence score "${signal.confidence}" is out of bounds (0-100).`);
      return false;
    }

    // 4. Timeframe must be supported
    if (!this.supportedTimeframes.includes(signal.timeframe)) {
      console.warn(`[Strategy: ${this.name}] Validation failed: Timeframe "${signal.timeframe}" is not supported by this strategy.`);
      return false;
    }

    // 5. Must have a valid timestamp
    if (isNaN(signal.timestamp) || signal.timestamp <= 0) {
      console.warn(`[Strategy: ${this.name}] Validation failed: Invalid timestamp.`);
      return false;
    }

    return true;
  }
}
