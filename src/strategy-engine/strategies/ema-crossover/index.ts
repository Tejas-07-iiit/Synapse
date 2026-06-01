import { TradingStrategy, StrategyContext, StrategySignal } from "../../types";
import { SignalGenerator } from "../../core/signal-generator";
import { ConfidenceEngine } from "../../core/confidence-engine";

export class EMACrossoverStrategy implements TradingStrategy {
  public id = "ema-crossover";
  public name = "EMA Crossover Strategy";
  public description = "Triggers buy/sell orders based on Exponential Moving Average (12 and 26 period) crossovers.";
  public timeframe = "15m";
  public timeframes = ["5m", "15m", "1h", "4h"];
  public symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
  public enabled = true;
  public indicatorsRequired = ["ema12", "ema26"];
  public supportedRegimes = ["Bullish Trend","Bearish Trend","Breakout","High Volatility"];

  public analyze(context: StrategyContext): { direction: "LONG" | "SHORT" | "HOLD"; reasoning: string[] } {
    const { candles, indicators } = context;
    const lastIdx = candles.length - 1;
    const prevIdx = lastIdx - 1;

    const ema12Last = indicators.ema12[lastIdx];
    const ema26Last = indicators.ema26[lastIdx];
    const ema12Prev = indicators.ema12[prevIdx];
    const ema26Prev = indicators.ema26[prevIdx];

    let direction: "LONG" | "SHORT" | "HOLD" = "HOLD";
    const reasoning: string[] = [];

    const prevDiff = ema12Prev - ema26Prev;

    if (ema12Last > ema26Last && prevDiff <= 0) {
      direction = "LONG";
      reasoning.push(`Bullish Crossover: Fast EMA(12) crossed above Slow EMA(26) at $${candles[lastIdx].close.toFixed(2)}.`);
    } else if (ema12Last < ema26Last && prevDiff >= 0) {
      direction = "SHORT";
      reasoning.push(`Bearish Crossover: Fast EMA(12) crossed below Slow EMA(26) at $${candles[lastIdx].close.toFixed(2)}.`);
    }

    return { direction, reasoning };
  }

  public validate(context: StrategyContext): boolean {
    const { candles, indicators } = context;
    return (
      candles.length >= 2 &&
      indicators.ema12 !== undefined &&
      indicators.ema26 !== undefined &&
      indicators.ema12.length >= 2 &&
      indicators.ema26.length >= 2
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
