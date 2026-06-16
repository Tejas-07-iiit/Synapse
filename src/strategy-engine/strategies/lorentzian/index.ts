import { TradingMode, ConsensusCategory, TradingStrategy, StrategyContext, StrategySignal } from "../../types";
import { SignalGenerator } from "../../core/signal-generator";

export class LorentzianStrategy implements TradingStrategy {
  public id = "lorentzian";
  public category: TradingMode = TradingMode.INTRADAY;
  public consensusCategory: ConsensusCategory = ConsensusCategory.INTRADAY;
  public expectedHoldingTime = "1h-8h";
  public name = "Lorentzian Classification";
  public description = "Institutional Trend.";
  public timeframe = "15m";
  public timeframes = ["15m", "30m", "1h"];
  public symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
  public enabled = true;
  public indicatorsRequired = ["rsi", "adx", "atr"];
  public supportedRegimes = ["TRENDING", "BREAKOUT"];

  public analyze(context: StrategyContext): { direction: "LONG" | "SHORT" | "HOLD"; reasoning: string[]; confidence: number } {
    const { candles, indicators } = context;
    const lastIdx = candles.length - 1;
    const adxLast = indicators.adx[lastIdx];
    const rsi = indicators.rsi[lastIdx];

    let direction: "LONG" | "SHORT" | "HOLD" = "HOLD";
    if (adxLast > 25 && rsi > 55) direction = "LONG";
    else if (adxLast > 25 && rsi < 45) direction = "SHORT";

    return { direction, reasoning: ["Trend Align"], confidence: 85 };
  }

  public validate(context: StrategyContext): boolean { return context.candles.length >= 100; }

  public generateSignal(context: StrategyContext): StrategySignal {
    const { direction, reasoning, confidence } = this.analyze(context);
    const { candles, indicators } = context;
    const close = candles[candles.length - 1].close;
    const atr = indicators.atr?.[candles.length - 1] || (close * 0.01);
    const signal = SignalGenerator.createSignal(this.id, direction, confidence, reasoning, context);
    if (direction !== "HOLD") {
      signal.stopLoss = Number((close - (direction === "LONG" ? 1.0 : -1.0) * atr).toFixed(4));
      signal.takeProfit = Number((close + (direction === "LONG" ? 1.0 : -1.0) * atr).toFixed(4));
    }
    return signal;
  }

  public evaluate(context: StrategyContext): StrategySignal {
    if (!this.enabled || !this.validate(context)) return SignalGenerator.createSignal(this.id, "HOLD", 0, ["N/A"], context);
    return this.generateSignal(context);
  }
}
