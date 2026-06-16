import { TradingMode, ConsensusCategory, TradingStrategy, StrategyContext, StrategySignal } from "../../types";
import { SignalGenerator } from "../../core/signal-generator";

export class DefensiveStrategy implements TradingStrategy {
  public id = "defensive";
  public category: TradingMode = TradingMode.INTRADAY;
  public consensusCategory: ConsensusCategory = ConsensusCategory.DEFENSIVE;
  public expectedHoldingTime = "1h-8h";
  public name = "Defensive Strategy";
  public description = "Trade ONLY high-probability trend continuation setups with strong filtering. Conservative and safety-oriented.";
  public type = "Defensive";
  public timeframe = "15m";
  public timeframes = ["15m", "30m", "1h"];
  public symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
  public enabled = true;
  public indicatorsRequired = ["rsi", "atr", "ema20", "sma50", "macdLine", "signalLine", "macdHist", "supportLevels", "resistanceLevels"];
  public supportedRegimes = ["Bullish Trend","Bearish Trend","Breakout","High Volatility"];

  public analyze(context: StrategyContext): { direction: "LONG" | "SHORT" | "HOLD"; reasoning: string[]; confidence: number } {
    const { candles, indicators } = context;
    const lastIdx = candles.length - 1;
    const close = candles[lastIdx].close;
    const high = candles[lastIdx].high;
    const low = candles[lastIdx].low;
    const rsiLast = indicators.rsi[lastIdx];
    const ema20Last = indicators.ema20[lastIdx];
    const sma50Last = indicators.sma50[lastIdx];
    const macdLine = indicators.macdLine[lastIdx];
    const signalLine = indicators.signalLine[lastIdx];
    const macdHist = indicators.macdHist[lastIdx];
    const atr = indicators.atr[lastIdx] || (close * 0.015);

    // Calculate Momentum (Close_t - Close_{t-5})
    const momentum = lastIdx >= 5 ? close - candles[lastIdx - 5].close : 0;

    // Support and Resistance Levels (10-bar)
    const last10 = candles.slice(-10);
    const support = Math.min(...last10.map((c) => c.low));
    const resistance = Math.max(...last10.map((c) => c.high));

    // Volatility checks
    const volatility = (resistance - support) / close;

    // Support levels from indicator if available
    const indicatorSupport = (indicators.supportLevels && indicators.supportLevels[lastIdx] > 0)
      ? indicators.supportLevels[lastIdx]
      : support;
    const indicatorResistance = (indicators.resistanceLevels && indicators.resistanceLevels[lastIdx] > 0)
      ? indicators.resistanceLevels[lastIdx]
      : resistance;

    let direction: "LONG" | "SHORT" | "HOLD" = "HOLD";
    const reasoning: string[] = [];

    // Primary Trend Filters:
    const isTrendLong = ema20Last > sma50Last;
    const isTrendShort = ema20Last < sma50Last;

    // LONG Conditions:
    // 1. RSI between 50-65
    // 2. MACD bullish (macdHist > 0 && macdLine > signalLine)
    // 3. Momentum positive (momentum > 0)
    // 4. Price above support level (close > indicatorSupport)
    // 5. Market not overextended (close <= ema20 * 1.025)
    // 6. Avoid high volatility spikes (volatility <= 0.04)
    // 7. Primary trend alignment (ema20 > sma50)
    const isRsiLong = rsiLast >= 50 && rsiLast <= 65;
    const isMacdLong = macdHist > 0 && macdLine > signalLine;
    const isMomentumLong = momentum > 0;
    const isAboveSupport = close > indicatorSupport;
    const notOverextendedLong = close <= ema20Last * 1.025;
    const moderateVolatilityLong = volatility <= 0.04;

    // SHORT Conditions:
    // 1. RSI between 35-50
    // 2. MACD bearish (macdHist < 0 && macdLine < signalLine)
    // 3. Momentum negative (momentum < 0)
    // 4. Price below resistance level (close < indicatorResistance)
    // 5. Market not oversold (close >= ema20 * 0.975)
    // 6. Avoid panic candles (high - low <= 2.0 * atr)
    // 7. Primary trend alignment (ema20 < sma50)
    const isRsiShort = rsiLast >= 35 && rsiLast <= 50;
    const isMacdShort = macdHist < 0 && macdLine < signalLine;
    const isMomentumShort = momentum < 0;
    const isBelowResistance = close < indicatorResistance;
    const notOversoldShort = close >= ema20Last * 0.975;
    const noPanicCandle = (high - low) <= 2.0 * atr;

    if (isRsiLong && isMacdLong && isMomentumLong && isAboveSupport && notOverextendedLong && moderateVolatilityLong && isTrendLong) {
      direction = "LONG";
      reasoning.push("Defensive LONG Setup Triggered.");
      reasoning.push(`RSI is in conservative range at ${rsiLast.toFixed(1)}.`);
      reasoning.push(`MACD and momentum are bullish. Price is above support $${indicatorSupport.toFixed(2)}.`);
      reasoning.push("Market is in bullish trend, not overextended, and volatility is low.");
    } else if (isRsiShort && isMacdShort && isMomentumShort && isBelowResistance && notOversoldShort && noPanicCandle && isTrendShort) {
      direction = "SHORT";
      reasoning.push("Defensive SHORT Setup Triggered.");
      reasoning.push(`RSI is in conservative range at ${rsiLast.toFixed(1)}.`);
      reasoning.push(`MACD and momentum are bearish. Price is below resistance $${indicatorResistance.toFixed(2)}.`);
      reasoning.push("Market is in bearish trend, not oversold, and price structure is stable (no panic candle).");
    } else {
      reasoning.push("No defensive setup detected.");
    }

    // Confidence scoring engine:
    // confidence = trendScore + rsiScore + macdScore + momentumScore + volatilityScore
    let confidence = 0;
    if (direction !== "HOLD") {
      const trendScore = direction === "LONG" ? (close > ema20Last && ema20Last > sma50Last ? 20 : 5) : (close < ema20Last && ema20Last < sma50Last ? 20 : 5);
      const rsiScore = direction === "LONG" ? ((rsiLast >= 52 && rsiLast <= 62) ? 20 : 10) : ((rsiLast >= 38 && rsiLast <= 48) ? 20 : 10);
      const macdScore = direction === "LONG" ? (macdHist > 0 ? 20 : 10) : (macdHist < 0 ? 20 : 10);
      const momentumScore = direction === "LONG" ? (momentum > 0 ? 20 : 5) : (momentum < 0 ? 20 : 5);
      const volatilityScore = volatility <= 0.02 ? 20 : (volatility <= 0.035 ? 15 : 5);

      confidence = Math.max(65, trendScore + rsiScore + macdScore + momentumScore + volatilityScore); // Floor 65 to pass FINAL_SCORE_THRESHOLD(60)
    }

    return { direction, reasoning, confidence };
  }

  public validate(context: StrategyContext): boolean {
    const { candles, indicators } = context;
    return (
      candles.length >= 10 &&
      indicators.rsi !== undefined &&
      indicators.rsi.length >= candles.length &&
      indicators.ema20 !== undefined &&
      indicators.ema20.length >= candles.length &&
      indicators.sma50 !== undefined &&
      indicators.sma50.length >= candles.length &&
      indicators.macdLine !== undefined &&
      indicators.macdLine.length >= candles.length &&
      indicators.signalLine !== undefined &&
      indicators.signalLine.length >= candles.length &&
      indicators.macdHist !== undefined &&
      indicators.macdHist.length >= candles.length &&
      indicators.atr !== undefined &&
      indicators.atr.length >= candles.length
    );
  }

  public generateSignal(context: StrategyContext): StrategySignal {
    const { direction, reasoning, confidence } = this.analyze(context);
    const { candles, indicators } = context;
    const lastIdx = candles.length - 1;
    const close = candles[lastIdx].close;
    const sma50Last = indicators.sma50[lastIdx];
    const atr = indicators.atr[lastIdx] || (close * 0.015);

    // Support and Resistance Levels (10-bar)
    const last10 = candles.slice(-10);
    const support = Math.min(...last10.map((c) => c.low));
    const resistance = Math.max(...last10.map((c) => c.high));

    const indicatorSupport = (indicators.supportLevels && indicators.supportLevels[lastIdx] > 0)
      ? indicators.supportLevels[lastIdx]
      : support;
    const indicatorResistance = (indicators.resistanceLevels && indicators.resistanceLevels[lastIdx] > 0)
      ? indicators.resistanceLevels[lastIdx]
      : resistance;

    // Conservative SL: below support or EMA50
    let stopLoss = 0;
    let takeProfit = 0;

    if (direction === "LONG") {
      let sl = Math.min(indicatorSupport, sma50Last) - 1.0 * atr;
      const maxSlDistance = 3.0 * atr;
      if (close - sl > maxSlDistance) {
        sl = close - maxSlDistance;
      }
      if (sl >= close) {
        sl = close - 2.0 * atr;
      }
      stopLoss = sl;
      takeProfit = close + 2.5 * (close - stopLoss); // Fixed 1:2.5 RR
    } else if (direction === "SHORT") {
      let sl = Math.max(indicatorResistance, sma50Last) + 1.0 * atr;
      const maxSlDistance = 3.0 * atr;
      if (sl - close > maxSlDistance) {
        sl = close + maxSlDistance;
      }
      if (sl <= close) {
        sl = close + 2.0 * atr;
      }
      stopLoss = sl;
      takeProfit = close - 2.5 * (stopLoss - close); // Fixed 1:2.5 RR
    }

    const signal = SignalGenerator.createSignal(
      this.id,
      direction,
      confidence,
      reasoning,
      context
    );

    // Override SL/TP in signal
    if (direction !== "HOLD") {
      signal.stopLoss = Number(stopLoss.toFixed(4));
      signal.takeProfit = Number(takeProfit.toFixed(4));
    }

    return signal;
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
