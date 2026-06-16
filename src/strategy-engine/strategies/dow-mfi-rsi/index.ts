import { TradingMode, ConsensusCategory, TradingStrategy, StrategyContext, StrategySignal } from "../../types";
import { SignalGenerator } from "../../core/signal-generator";

export class DowFactorMFIRSIStrategy implements TradingStrategy {
  public id = "dow-mfi-rsi";
  public category: TradingMode = TradingMode.INTRADAY;
  public consensusCategory: ConsensusCategory = ConsensusCategory.INTRADAY;
  public expectedHoldingTime = "1h-8h";
  public name = "Dow Factor MFI RSI Strategy";
  public description = "Institutional grade trend follow.";
  public timeframe = "15m";
  public timeframes = ["15m", "30m", "1h"];
  public symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
  public enabled = true;
  public indicatorsRequired = ["rsi", "atr", "volumeMA", "mfi"];
  public supportedRegimes = ["Bullish Trend","Bearish Trend","Breakout"];

  public analyze(context: StrategyContext): { direction: "LONG" | "SHORT" | "HOLD"; reasoning: string[]; confidence: number } {
    const { candles, indicators, structure } = context;
    const lastIdx = candles.length - 1;
    const rsi = indicators.rsi[lastIdx];
    const mfi = indicators.mfi?.[lastIdx] ?? 50;
    const dowStructure = structure?.dowStructure || "RANGING";

    let direction: "LONG" | "SHORT" | "HOLD" = "HOLD";
    if (dowStructure === "BULLISH" && rsi > 50 && mfi > 50) direction = "LONG";
    else if (dowStructure === "BEARISH" && rsi < 50 && mfi < 50) direction = "SHORT";

    return { direction, reasoning: ["Dow Align"], confidence: 90 };
  }

  public validate(context: StrategyContext): boolean { return context.candles.length >= 200 && context.indicators.mfi !== undefined; }

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
