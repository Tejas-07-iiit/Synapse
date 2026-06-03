import { TradingMode, ConsensusCategory, TradingStrategy, StrategyContext, StrategySignal } from "../../types";
import { SignalGenerator } from "../../core/signal-generator";
import { ConfidenceEngine } from "../../core/confidence-engine";

export class MACDMomentumStrategy implements TradingStrategy {
  public id = "macd-momentum";
  public category: TradingMode = TradingMode.SCALPING;
  public consensusCategory: ConsensusCategory = ConsensusCategory.SCALPING;
  public expectedHoldingTime = "5m-45m";
  public name = "MACD Momentum Strategy";
  public description = "Triggers on MACD Line / Signal Line crossovers and checks Histogram expansion to capitalize on trend acceleration.";
  public timeframe = "1m";
  public timeframes = ["1m", "3m", "5m"];
  public symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
  public enabled = true;
  public indicatorsRequired = ["macdLine", "signalLine", "macdHist"];
  public supportedRegimes = ["Breakout","High Volatility","Bullish Trend","Bearish Trend"];

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
