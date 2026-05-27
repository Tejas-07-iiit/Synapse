import { TradingStrategy, StrategyContext, StrategySignal } from "../../types";
import { SignalGenerator } from "../../core/signal-generator";
import { ConfidenceEngine } from "../../core/confidence-engine";

export class MACDMomentumStrategy implements TradingStrategy {
  public id = "macd-momentum";
  public name = "MACD Momentum Strategy";
  public description = "Triggers on MACD Line / Signal Line crossovers and checks Histogram expansion to capitalize on trend acceleration.";
  public timeframe = "15m";
  public timeframes = ["5m", "15m", "1h", "4h"];
  public symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
  public enabled = true;
  public indicatorsRequired = ["macdLine", "signalLine", "macdHist"];

  public analyze(context: StrategyContext): { direction: "LONG" | "SHORT" | "HOLD"; reasoning: string[] } {
    const { candles, indicators } = context;
    const lastIdx = candles.length - 1;
    const prevIdx = lastIdx - 1;

    const macdLineLast = indicators.macdLine[lastIdx];
    const signalLineLast = indicators.signalLine[lastIdx];
    const macdLinePrev = indicators.macdLine[prevIdx];
    const signalLinePrev = indicators.signalLine[prevIdx];
    const macdHistLast = indicators.macdHist[lastIdx];
    const macdHistPrev = indicators.macdHist[prevIdx];

    let direction: "LONG" | "SHORT" | "HOLD" = "HOLD";
    const reasoning: string[] = [];

    const lastDiff = macdLineLast - signalLineLast;
    const prevDiff = macdLinePrev - signalLinePrev;

    // MACD Crosses
    if (lastDiff > 0 && prevDiff <= 0) {
      direction = "LONG";
      reasoning.push(`MACD Bullish Crossover: MACD line crossed above the signal line.`);
    } else if (lastDiff < 0 && prevDiff >= 0) {
      direction = "SHORT";
      reasoning.push(`MACD Bearish Crossover: MACD line crossed below the signal line.`);
    }
    // Histogram momentum confirmations
    else if (macdHistLast > 0) {
      direction = "LONG";
      reasoning.push(`MACD Bullish Momentum: Histogram remains positive at ${macdHistLast.toFixed(2)}.`);
      if (macdHistLast > macdHistPrev) {
        reasoning.push(`Momentum is expanding upwards.`);
      }
    } else if (macdHistLast < 0) {
      direction = "SHORT";
      reasoning.push(`MACD Bearish Momentum: Histogram remains negative at ${macdHistLast.toFixed(2)}.`);
      if (macdHistLast < macdHistPrev) {
        reasoning.push(`Momentum is expanding downwards.`);
      }
    }

    return { direction, reasoning };
  }

  public validate(context: StrategyContext): boolean {
    const { candles, indicators } = context;
    return (
      candles.length >= 2 &&
      indicators.macdLine !== undefined &&
      indicators.signalLine !== undefined &&
      indicators.macdHist !== undefined &&
      indicators.macdLine.length >= 2
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
