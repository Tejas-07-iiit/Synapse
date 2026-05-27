import { registerStrategy } from "../core/registry";
import { EMACrossoverStrategy } from "./ema-crossover";
import { RSIReversalStrategy } from "./rsi-reversal";
import { MACDMomentumStrategy } from "./macd-momentum";
import { BollingerBreakoutStrategy } from "./bollinger-breakout";

export * from "./ema-crossover";
export * from "./rsi-reversal";
export * from "./macd-momentum";
export * from "./bollinger-breakout";

let isInitialized = false;

/**
 * Initializes and registers all built-in trading strategies.
 * Idempotent - can be safely called multiple times.
 */
export function initializeStrategies(): void {
  if (isInitialized) return;
  
  registerStrategy(new EMACrossoverStrategy());
  registerStrategy(new RSIReversalStrategy());
  registerStrategy(new MACDMomentumStrategy());
  registerStrategy(new BollingerBreakoutStrategy());

  isInitialized = true;
  console.log("[Strategies] Plug-and-play strategies initialized successfully.");
}
