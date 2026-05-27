import { TradingStrategy, StrategyContext, StrategySignal } from "../../types";
import { SignalGenerator } from "../../core/signal-generator";
import { ConfidenceEngine } from "../../core/confidence-engine";

export class RSIReversalStrategy implements TradingStrategy {
  public id = "rsi-reversal";
  public name = "RSI Reversal Strategy";
  public description = "Identifies oversold market bottoms (< 30) and overbought market tops (> 70) to capture swing trade entries.";
  public timeframe = "15m";
  public timeframes = ["5m", "15m", "1h", "4h"];
  public symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
  public enabled = true;
  public indicatorsRequired = ["rsi"];

  public analyze(context: StrategyContext): { direction: "LONG" | "SHORT" | "HOLD"; reasoning: string[] } {
    const { candles, indicators } = context;
    const lastIdx = candles.length - 1;
    const rsiLast = indicators.rsi[lastIdx];
    const rsiPrev = indicators.rsi[lastIdx - 1];

    let direction: "LONG" | "SHORT" | "HOLD" = "HOLD";
    const reasoning: string[] = [];

    // Reversal logic:
    // Oversold and beginning to bounce: RSI was below 30 and starts crossing up
    if (rsiLast <= 30) {
      direction = "LONG";
      reasoning.push(`Oversold Reversal setup: RSI is deeply oversold at ${rsiLast.toFixed(1)} (<= 30).`);
      if (rsiLast > rsiPrev) {
        reasoning.push(`Oversold Bounce: RSI has started turning upward, indicating buying pressure starting to recover.`);
      }
    } 
    // Overbought and beginning to slide: RSI was above 70 and starts crossing down
    else if (rsiLast >= 70) {
      direction = "SHORT";
      reasoning.push(`Overbought Correction setup: RSI is overbought at ${rsiLast.toFixed(1)} (>= 70).`);
      if (rsiLast < rsiPrev) {
        reasoning.push(`Overbought Pullback: RSI has started bending downward, indicating selling pressure starting to mount.`);
      }
    } else {
      reasoning.push(`RSI is in neutral territory at ${rsiLast.toFixed(1)}.`);
    }

    return { direction, reasoning };
  }

  public validate(context: StrategyContext): boolean {
    const { candles, indicators } = context;
    return (
      candles.length >= 2 &&
      indicators.rsi !== undefined &&
      indicators.rsi.length >= 2
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
