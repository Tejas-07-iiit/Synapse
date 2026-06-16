import { TradingMode, ConsensusCategory, TradingStrategy, StrategyContext, StrategySignal } from "../../types";
import { SignalGenerator } from "../../core/signal-generator";

export class BollingerReversionStrategy implements TradingStrategy {
  public id = "bollinger-reversion";
  public category: TradingMode = TradingMode.INTRADAY;
  public consensusCategory: ConsensusCategory = ConsensusCategory.INTRADAY;
  public expectedHoldingTime = "30m-4h";
  public name = "Bollinger Reversion Strategy";
  public description = "High-probability mean reversion targeting price returns inside Bollinger Bands after exhaustion.";
  public timeframe = "15m";
  public timeframes = ["15m", "30m", "1h"];
  public symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
  public enabled = true;
  public indicatorsRequired = ["bbUpper", "bbMiddle", "bbLower", "rsi", "atr"];
  public supportedRegimes = ["RANGING", "LOW_VOLATILITY", "ACCUMULATION", "DISTRIBUTION"];

  public analyze(context: StrategyContext): { direction: "LONG" | "SHORT" | "HOLD"; reasoning: string[]; confidence: number } {
    const { candles, indicators } = context;
    const lastIdx = candles.length - 1;
    const { open, close, high, low } = candles[lastIdx];
    const prevLow = candles[lastIdx - 1].low;
    const prevHigh = candles[lastIdx - 1].high;
    const prevClose = candles[lastIdx - 1].close;

    const bbLower = indicators.bbLower[lastIdx];
    const bbUpper = indicators.bbUpper[lastIdx];
    const prevBbLower = indicators.bbLower[lastIdx - 1];
    const prevBbUpper = indicators.bbUpper[lastIdx - 1];
    const rsi = indicators.rsi[lastIdx];

    let direction: "LONG" | "SHORT" | "HOLD" = "HOLD";
    const reasoning: string[] = [];

    // LONG: Spring pattern (Deep sweep below band, then close inside)
    const isSpring = prevLow < prevBbLower && close > bbLower && close > open;
    const isBullishRejection = (close - low) / (high - low) > 0.3;
    
    // SHORT: Upthrust pattern (Deep sweep above band, then close inside)
    const isUpthrust = prevHigh > prevBbUpper && close < bbUpper && close < open;
    const isBearishRejection = (high - close) / (high - low) > 0.3;

    if (isSpring && rsi < 35 && isBullishRejection) {
      direction = "LONG";
      reasoning.push("Bollinger Spring: Price swept below lower band and closed inside with bullish rejection.");
    } else if (isUpthrust && rsi > 65 && isBearishRejection) {
      direction = "SHORT";
      reasoning.push("Bollinger Upthrust: Price swept above upper band and closed inside with bearish rejection.");
    }

    return { direction, reasoning, confidence: 95 };
  }

  public validate(context: StrategyContext): boolean {
    return (
      context.candles.length >= 20 &&
      context.indicators.bbUpper !== undefined &&
      context.indicators.bbLower !== undefined &&
      context.indicators.rsi !== undefined &&
      context.indicators.atr !== undefined
    );
  }

  public generateSignal(context: StrategyContext): StrategySignal {
    const { direction, reasoning, confidence } = this.analyze(context);
    const { candles, indicators } = context;
    const close = candles[candles.length - 1].close;
    const atr = indicators.atr?.[candles.length - 1] || (close * 0.015);

    const signal = SignalGenerator.createSignal(this.id, direction, confidence, reasoning, context);

    if (direction !== "HOLD") {
      // 1:1.4 Risk/Reward for fee-efficiency and high win rate
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
