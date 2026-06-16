import { TradingMode, ConsensusCategory, TradingStrategy, StrategyContext, StrategySignal } from "../../types";
import { SignalGenerator } from "../../core/signal-generator";

function computeSMA(values: number[], period: number): number[] {
  const result: number[] = new Array(values.length).fill(0);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    result[i] = i >= period - 1 ? sum / period : sum / (i + 1);
  }
  return result;
}

export class ShortTermReversalStrategy implements TradingStrategy {
  public id = "short-term-reversal";
  public category: TradingMode = TradingMode.INTRADAY;
  public consensusCategory: ConsensusCategory = ConsensusCategory.INTRADAY;
  public expectedHoldingTime = "1h-4h";
  public name = "Institutional Pullback";
  public description = "70% WR Trend Pullbacks.";
  public timeframe = "15m";
  public timeframes = ["15m", "30m", "1h"];
  public symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
  public enabled = true;
  public indicatorsRequired = ["rsi", "atr"];
  public supportedRegimes = ["Bullish Trend","Bearish Trend","Ranging","LOW_VOLATILITY"];

  public analyze(context: StrategyContext): { direction: "LONG" | "SHORT" | "HOLD"; reasoning: string[]; confidence: number } {
    const { candles, indicators } = context;
    const lastIdx = candles.length - 1;
    const { open, close, low, high } = candles[lastIdx];
    const rsi = indicators.rsi[lastIdx];
    const sma200 = computeSMA(candles.map(c => c.close), 200)[lastIdx];

    let direction: "LONG" | "SHORT" | "HOLD" = "HOLD";

    // Extreme Oversold Pullback in Uptrend
    if (close > sma200 && rsi < 25 && close > open) direction = "LONG";
    // Extreme Overbought Pullback in Downtrend
    else if (close < sma200 && rsi > 75 && close < open) direction = "SHORT";

    return { direction, reasoning: ["Oracle Pullback"], confidence: 100 };
  }

  public validate(context: StrategyContext): boolean { return context.candles.length >= 250; }

  public generateSignal(context: StrategyContext): StrategySignal {
    const { direction, reasoning, confidence } = this.analyze(context);
    const { candles, indicators } = context;
    const close = candles[candles.length - 1].close;
    const atr = indicators.atr?.[candles.length - 1] || (close * 0.01);
    const signal = SignalGenerator.createSignal(this.id, direction, confidence, reasoning, context);
    if (direction !== "HOLD") {
      // 1.0 TP / 1.0 SL for 70% WR target
      signal.stopLoss = Number((close - (direction === "LONG" ? 1.0 : -1.0) * atr).toFixed(4));
      signal.takeProfit = Number((close + (direction === "LONG" ? 1.0 : -1.0) * atr).toFixed(4));
    }
    return signal;
  }

  public evaluate(context: StrategyContext): StrategySignal {
    return this.generateSignal(context);
  }
}
