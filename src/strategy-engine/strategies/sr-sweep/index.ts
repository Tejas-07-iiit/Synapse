import { TradingMode, ConsensusCategory, TradingStrategy, StrategyContext, StrategySignal } from "../../types";
import { SignalGenerator } from "../../core/signal-generator";

export class SRSweepStrategy implements TradingStrategy {
  public id = "sr-sweep";
  public category: TradingMode = TradingMode.INTRADAY;
  public consensusCategory: ConsensusCategory = ConsensusCategory.INTRADAY;
  public expectedHoldingTime = "1h-6h";
  public name = "Support Resistance Sweep Strategy";
  public description = "Institutional liquidity grab detection sweeping major S/R levels.";
  public timeframe = "1h";
  public timeframes = ["15m", "30m", "1h"];
  public symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
  public enabled = true;
  public indicatorsRequired = ["rsi", "atr", "volumeMA"];
  public supportedRegimes = ["RANGING", "ACCUMULATION", "DISTRIBUTION", "BREAKOUT", "Bullish Trend", "Bearish Trend", "TRENDING", "HIGH_VOLATILITY", "LOW_VOLATILITY"];

  public analyze(context: StrategyContext): { direction: "LONG" | "SHORT" | "HOLD"; reasoning: string[]; confidence: number; sweepPrice: number } {
    const { candles, indicators } = context;
    const lastIdx = candles.length - 1;
    const { low, high, close, open, volume } = candles[lastIdx];
    const volumeMA = indicators.volumeMA?.[lastIdx] || 1;

    // Use recent high/low as S/R levels
    const prev30Highs = candles.slice(-30, -1).map(c => c.high);
    const prev30Lows = candles.slice(-30, -1).map(c => c.low);
    const resistance = Math.max(...prev30Highs);
    const support = Math.min(...prev30Lows);

    let direction: "LONG" | "SHORT" | "HOLD" = "HOLD";
    const reasoning: string[] = [];
    let sweepPrice = 0;

    const isHighVolume = volume > volumeMA * 1.1;
    const isBullishRejection = close > open && (close - low) / (high - low) > 0.35;
    const isBearishRejection = close < open && (high - close) / (high - low) > 0.35;

    if (low < support && close > support && isHighVolume && isBullishRejection) {
      direction = "LONG";
      sweepPrice = support;
      reasoning.push(`Liquidity Sweep LONG: Price swept below major support ($${support.toFixed(2)}) and reclaimed.`);
    } else if (high > resistance && close < resistance && isHighVolume && isBearishRejection) {
      direction = "SHORT";
      sweepPrice = resistance;
      reasoning.push(`Liquidity Sweep SHORT: Price swept above major resistance ($${resistance.toFixed(2)}) and reversed.`);
    }

    return { direction, reasoning, confidence: 95, sweepPrice };
  }

  public validate(context: StrategyContext): boolean {
    return context.candles.length >= 40 && context.indicators.volumeMA !== undefined && context.indicators.atr !== undefined;
  }

  public generateSignal(context: StrategyContext): StrategySignal {
    const { direction, reasoning, confidence } = this.analyze(context);
    const { candles, indicators } = context;
    const close = candles[candles.length - 1].close;
    const atr = indicators.atr?.[candles.length - 1] || (close * 0.015);

    const signal = SignalGenerator.createSignal(this.id, direction, confidence, reasoning, context);

    if (direction !== "HOLD") {
      // 1:1.4 Risk/Reward for fee-efficiency
      signal.stopLoss = Number((close - (direction === "LONG" ? 2.5 : -2.5) * atr).toFixed(4));
      signal.takeProfit = Number((close + (direction === "LONG" ? 3.5 : -3.5) * atr).toFixed(4));
    }

    return signal;
  }

  public evaluate(context: StrategyContext): StrategySignal {
    if (!this.enabled || !this.validate(context)) {
      return SignalGenerator.createSignal(this.id, "HOLD", 0, ["Disabled/Invalid"], context);
    }
    return this.generateSignal(context);
  }
}
