import { TradingMode, ConsensusCategory, TradingStrategy, StrategyContext, StrategySignal } from "../../types";
import { SignalGenerator } from "../../core/signal-generator";
import { ConfidenceEngine } from "../../core/confidence-engine";

export class RSIReversalStrategy implements TradingStrategy {
  public id = "rsi-reversal";
  public category: TradingMode = TradingMode.SCALPING;
  public consensusCategory: ConsensusCategory = ConsensusCategory.SCALPING;
  public expectedHoldingTime = "5m-45m";
  public name = "RSI Reversal Strategy";
  public description = "Identifies oversold market bottoms (< 30) and overbought market tops (> 70) to capture swing trade entries.";
  public timeframe = "1m";
  public timeframes = ["1m", "3m", "5m"];
  public symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
  public enabled = true;
  public indicatorsRequired = ["rsi"];
  public supportedRegimes = ["Ranging","Accumulation","Distribution","Low Volatility"];

  public analyze(context: StrategyContext): { direction: "LONG" | "SHORT" | "HOLD"; reasoning: string[] } {
    const { candles, indicators } = context;
    const lastIdx = candles.length - 1;
    const rsiLast = indicators.rsi[lastIdx];
    const rsiPrev = indicators.rsi[lastIdx - 1];

    let direction: "LONG" | "SHORT" | "HOLD" = "HOLD";
    const reasoning: string[] = [];

    // Reversal logic:
    // Oversold and beginning to bounce: RSI was below 30 and starts crossing up
    if (rsiPrev <= 30 && rsiLast > 30) {
      direction = "LONG";
      reasoning.push(`Oversold Reversal Crossover: RSI crossed above 30 from oversold levels (RSI: ${rsiLast.toFixed(1)}).`);
    } 
    // Overbought and beginning to slide: RSI was above 70 and starts crossing down
    else if (rsiPrev >= 70 && rsiLast < 70) {
      direction = "SHORT";
      reasoning.push(`Overbought Reversal Crossover: RSI crossed below 70 from overbought levels (RSI: ${rsiLast.toFixed(1)}).`);
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
    const confidence = ConfidenceEngine.calculate(direction, context, this.id);

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
