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
import { ParabolicRSIStrategy } from "./parabolic-rsi";
import { RangeBreakoutHighStrategy } from "./range-breakout-high";
import { ResidualMomentumStrategy } from "./residual-momentum";
import { TimeSeriesMomentumStrategy } from "./time-series-momentum";
import { WaveTrendStrategy } from "./wavetrend";
import { HashRibbonsStrategy } from "./hash-ribbons";
import { NewsFearGreedStrategy } from "./news-fear-greed";
import { EMACrossADXStrategy } from "./ema-cross-adx";
import { GoldenCrossStrategy } from "./golden-cross";
import { HeikenAshiSwingStrategy } from "./heiken-ashi-swing";
import { HyperSupertrendStrategy } from "./hyper-supertrend";
import { IchimokuCloudStrategy } from "./ichimoku-cloud";
import { MACrossoverVariableStrategy } from "./ma-crossover-var";
import { SMATrendFilterStrategy } from "./sma-trend-filter";
import { T3NexusStrategy } from "./t3-nexus";
import { SqueezeMomentumStrategy } from "./squeeze-momentum";
import { VolatilityRegimeStrategy } from "./volatility-regime";
import { ZeiiermanVolatilityStrategy } from "./zeiierman-volatility";

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
export * from "./parabolic-rsi";
export * from "./range-breakout-high";
export * from "./residual-momentum";
export * from "./time-series-momentum";
export * from "./wavetrend";
export * from "./hash-ribbons";
export * from "./news-fear-greed";
export * from "./ema-cross-adx";
export * from "./golden-cross";
export * from "./heiken-ashi-swing";
export * from "./hyper-supertrend";
export * from "./ichimoku-cloud";
export * from "./ma-crossover-var";
export * from "./sma-trend-filter";
export * from "./t3-nexus";
export * from "./squeeze-momentum";
export * from "./volatility-regime";
export * from "./zeiierman-volatility";

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
  registerStrategy(new ParabolicRSIStrategy());
  registerStrategy(new RangeBreakoutHighStrategy());
  registerStrategy(new ResidualMomentumStrategy());
  registerStrategy(new TimeSeriesMomentumStrategy());
  registerStrategy(new WaveTrendStrategy());
  registerStrategy(new HashRibbonsStrategy());
  registerStrategy(new NewsFearGreedStrategy());
  registerStrategy(new EMACrossADXStrategy());
  registerStrategy(new GoldenCrossStrategy());
  registerStrategy(new HeikenAshiSwingStrategy());
  registerStrategy(new HyperSupertrendStrategy());
  registerStrategy(new IchimokuCloudStrategy());
  registerStrategy(new MACrossoverVariableStrategy());
  registerStrategy(new SMATrendFilterStrategy());
  registerStrategy(new T3NexusStrategy());
  registerStrategy(new SqueezeMomentumStrategy());
  registerStrategy(new VolatilityRegimeStrategy());
  registerStrategy(new ZeiiermanVolatilityStrategy());

  isInitialized = true;
  console.log("[Strategies] Plug-and-play strategies initialized successfully.");
}

