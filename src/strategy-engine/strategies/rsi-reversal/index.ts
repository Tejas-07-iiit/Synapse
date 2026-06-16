import { TradingMode, ConsensusCategory, TradingStrategy, StrategyContext, StrategySignal } from "../../types";
import { SignalGenerator } from "../../core/signal-generator";

export class RSIReversalStrategy implements TradingStrategy {
  public id = "rsi-reversal";
  public category: TradingMode = TradingMode.INTRADAY;
  public consensusCategory: ConsensusCategory = ConsensusCategory.INTRADAY;
  public expectedHoldingTime = "15m-1h";
  public name = "RSI Reversal Strategy";
  public description = "Mean reversion based on extreme RSI exhaustion combined with candle rejection.";
  public timeframe = "15m";
  public timeframes = ["15m", "30m", "1h"];
  public symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
  public enabled = true;
  public indicatorsRequired = ["rsi", "atr"];
  public supportedRegimes = ["RANGING", "LOW_VOLATILITY", "ACCUMULATION", "DISTRIBUTION"];

  public analyze(context: StrategyContext): { direction: "LONG" | "SHORT" | "HOLD"; reasoning: string[] } {
    const { candles, indicators } = context;
    const lastIdx = candles.length - 1;
    const rsiLast = indicators.rsi[lastIdx];
    const { open, close, high, low } = candles[lastIdx];

    let direction: "LONG" | "SHORT" | "HOLD" = "HOLD";
    const reasoning: string[] = [];

    const isBullishRejection = close > open && (close - open) / (high - low) > 0.3;
    const isBearishRejection = close < open && (open - close) / (high - low) > 0.3;

    if (rsiLast < 30 && isBullishRejection) {
      direction = "LONG";
      reasoning.push(`Extreme RSI Exhaustion: RSI at ${rsiLast.toFixed(1)} with bullish rejection candle.`);
    } else if (rsiLast > 70 && isBearishRejection) {
      direction = "SHORT";
      reasoning.push(`Extreme RSI Overbought: RSI at ${rsiLast.toFixed(1)} with bearish rejection candle.`);
    }

    return { direction, reasoning };
  }

  public validate(context: StrategyContext): boolean {
    return context.candles.length >= 50 && context.indicators.rsi !== undefined && context.indicators.atr !== undefined;
  }

  public generateSignal(context: StrategyContext): StrategySignal {
    const { direction, reasoning } = this.analyze(context);
    const { candles, indicators } = context;
    const close = candles[candles.length - 1].close;
    const atr = indicators.atr?.[candles.length - 1] || (close * 0.015);

    const signal = SignalGenerator.createSignal(this.id, direction, 90, reasoning, context);

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
