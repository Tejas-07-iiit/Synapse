import { registerStrategy } from "../core/registry";
import { EMACrossoverStrategy } from "./ema-crossover";
import { RSIReversalStrategy } from "./rsi-reversal";
import { MACDMomentumStrategy } from "./macd-momentum";
import { BollingerBreakoutStrategy } from "./bollinger-breakout";
import { MeanReversionStrategy } from "./mean-reversion";
import { MomentumStrategy } from "./momentum";
import { DefensiveStrategy } from "./defensive";
import { GridStrategy } from "./grid";
import { LorentzianStrategy } from "./lorentzian";
import { DonchianBreakoutStrategy } from "./donchian-breakout";
import { RallyBaseDropStrategy } from "./rally-base-drop";
import { SRSweepStrategy } from "./sr-sweep";
import { BollingerReversionStrategy } from "./bollinger-reversion";
import { ShortTermReversalStrategy } from "./short-term-reversal";
import { DowFactorMFIRSIStrategy } from "./dow-mfi-rsi";

export * from "./ema-crossover";
export * from "./rsi-reversal";
export * from "./macd-momentum";
export * from "./bollinger-breakout";
export * from "./mean-reversion";
export * from "./momentum";
export * from "./defensive";
export * from "./grid";
export * from "./lorentzian";
export * from "./donchian-breakout";
export * from "./rally-base-drop";
export * from "./sr-sweep";
export * from "./bollinger-reversion";
export * from "./short-term-reversal";
export * from "./dow-mfi-rsi";

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
  registerStrategy(new MeanReversionStrategy());
  registerStrategy(new MomentumStrategy());
  registerStrategy(new DefensiveStrategy());
  registerStrategy(new GridStrategy());
  registerStrategy(new LorentzianStrategy());
  registerStrategy(new DonchianBreakoutStrategy());
  registerStrategy(new RallyBaseDropStrategy());
  registerStrategy(new SRSweepStrategy());
  registerStrategy(new BollingerReversionStrategy());
  registerStrategy(new ShortTermReversalStrategy());
  registerStrategy(new DowFactorMFIRSIStrategy());

  isInitialized = true;
  console.log("[Strategies] Plug-and-play strategies initialized successfully.");
}

