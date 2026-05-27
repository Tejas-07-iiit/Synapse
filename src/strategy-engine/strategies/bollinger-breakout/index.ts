import { TradingStrategy, StrategyContext, StrategySignal } from "../../types";
import { SignalGenerator } from "../../core/signal-generator";
import { ConfidenceEngine } from "../../core/confidence-engine";

export class BollingerBreakoutStrategy implements TradingStrategy {
  public id = "bollinger-breakout";
  public name = "Bollinger Breakout Strategy";
  public description = "Triggers buy/sell setups when the price breaks outside the Bollinger Bands channels under expanding volume conditions.";
  public timeframe = "15m";
  public timeframes = ["5m", "15m", "1h", "4h"];
  public symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
  public enabled = true;
  public indicatorsRequired = ["bbUpper", "bbLower", "bbMiddle"];

  public analyze(context: StrategyContext): { direction: "LONG" | "SHORT" | "HOLD"; reasoning: string[] } {
    const { candles, indicators } = context;
    const lastIdx = candles.length - 1;
    const close = candles[lastIdx].close;
    
    const bbUpperLast = indicators.bbUpper[lastIdx];
    const bbLowerLast = indicators.bbLower[lastIdx];

    let direction: "LONG" | "SHORT" | "HOLD" = "HOLD";
    const reasoning: string[] = [];

    // Breakout logic
    if (close > bbUpperLast) {
      direction = "LONG";
      reasoning.push(`Bullish Breakout: Price closed at $${close.toFixed(2)} above upper Bollinger Band support ($${bbUpperLast.toFixed(2)}).`);
    } else if (close < bbLowerLast) {
      direction = "SHORT";
      reasoning.push(`Bearish Breakdown: Price closed at $${close.toFixed(2)} below lower Bollinger Band support ($${bbLowerLast.toFixed(2)}).`);
    } else {
      const channelPercent = bbUpperLast !== bbLowerLast 
        ? ((close - bbLowerLast) / (bbUpperLast - bbLowerLast)) * 100 
        : 50;
      reasoning.push(`Ranging Channel: Price remains inside the bands, sitting at ${channelPercent.toFixed(0)}% of the channel range.`);
    }

    return { direction, reasoning };
  }

  public validate(context: StrategyContext): boolean {
    const { candles, indicators } = context;
    return (
      candles.length >= 2 &&
      indicators.bbUpper !== undefined &&
      indicators.bbLower !== undefined &&
      indicators.bbMiddle !== undefined &&
      indicators.bbUpper.length >= 2
    );
  }

  public generateSignal(context: StrategyContext): StrategySignal {
    const { direction, reasoning } = this.analyze(context);
    const confidence = ConfidenceEngine.calculate(direction, context);

    return SignalGenerator.createSignal(
      this.id,
      direction,
      confidence,
      reasoning,
      context
    );
  }

  public evaluate(context: StrategyContext): StrategySignal {
    if (!this.enabled || !this.validate(context)) {
      return SignalGenerator.createSignal(
        this.id,
        "HOLD",
        0,
        ["Strategy disabled or validation failed due to insufficient indicators data."],
        context
      );
    }
    return this.generateSignal(context);
  }
}
