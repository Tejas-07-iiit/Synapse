import { TradingStrategy, StrategyContext, StrategySignal } from "../../types";
import { SignalGenerator } from "../../core/signal-generator";

export class MomentumStrategy implements TradingStrategy {
  public id = "momentum";
  public name = "Momentum Strategy";
  public description = "Capture strong directional continuation moves with trend confirmation.";
  public type = "Momentum";
  public timeframe = "15m";
  public timeframes = ["5m", "15m"];
  public symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
  public enabled = true;
  public indicatorsRequired = ["rsi", "atr", "ema20", "sma50", "macdLine", "signalLine", "macdHist", "bbUpper", "bbMiddle", "bbLower"];

  public analyze(context: StrategyContext): { direction: "LONG" | "SHORT" | "HOLD"; reasoning: string[]; confidence: number } {
    const { candles, indicators } = context;
    const lastIdx = candles.length - 1;
    const close = candles[lastIdx].close;
    const rsiLast = indicators.rsi[lastIdx];
    const ema20Last = indicators.ema20[lastIdx];
    const sma50Last = indicators.sma50[lastIdx];
    const macdLine = indicators.macdLine[lastIdx];
    const signalLine = indicators.signalLine[lastIdx];
    const macdHist = indicators.macdHist[lastIdx];
    const atr = indicators.atr[lastIdx] || (close * 0.015);

    // Calculate Momentum (Close_t - Close_{t-5})
    const momentum = lastIdx >= 5 ? close - candles[lastIdx - 5].close : 0;
    const prevMomentum = lastIdx >= 6 ? candles[lastIdx - 1].close - candles[lastIdx - 6].close : 0;

    // Volatility expanding check (Bollinger Band width)
    const bbUpper = indicators.bbUpper[lastIdx] || close;
    const bbLower = indicators.bbLower[lastIdx] || close;
    const bbMiddle = indicators.bbMiddle[lastIdx] || close;
    const bbWidth = bbMiddle > 0 ? (bbUpper - bbLower) / bbMiddle : 0;

    const prevBbUpper = lastIdx > 0 ? (indicators.bbUpper[lastIdx - 1] || close) : close;
    const prevBbLower = lastIdx > 0 ? (indicators.bbLower[lastIdx - 1] || close) : close;
    const prevBbMiddle = lastIdx > 0 ? (indicators.bbMiddle[lastIdx - 1] || close) : close;
    const prevBbWidth = prevBbMiddle > 0 ? (prevBbUpper - prevBbLower) / prevBbMiddle : 0;

    const volExpanding = bbWidth > prevBbWidth || atr > (lastIdx > 0 ? indicators.atr[lastIdx - 1] : atr);

    let direction: "LONG" | "SHORT" | "HOLD" = "HOLD";
    const reasoning: string[] = [];

    // LONG Conditions:
    // 1. EMA20 > EMA50
    // 2. MACD bullish crossover (macdLine > signalLine && macdHist > 0)
    // 3. RSI between 55-75
    // 4. Positive momentum acceleration (momentum > 0 && momentum > prevMomentum)
    // 5. Volatility expanding
    // 6. Candle closes above EMA20
    const isEmaBullish = ema20Last > sma50Last;
    const isMacdBullish = macdLine > signalLine && macdHist > 0;
    const isRsiBullish = rsiLast >= 55 && rsiLast <= 75;
    const isMomentumBullish = momentum > 0 && momentum > prevMomentum;
    const isCloseAboveEma20 = close > ema20Last;

    // SHORT Conditions:
    // 1. EMA20 < EMA50
    // 2. MACD bearish crossover (macdLine < signalLine && macdHist < 0)
    // 3. RSI between 25-45
    // 4. Negative momentum acceleration (momentum < 0 && momentum < prevMomentum)
    // 5. Volatility expanding
    // 6. Candle closes below EMA20
    const isEmaBearish = ema20Last < sma50Last;
    const isMacdBearish = macdLine < signalLine && macdHist < 0;
    const isRsiBearish = rsiLast >= 25 && rsiLast <= 45;
    const isMomentumBearish = momentum < 0 && momentum < prevMomentum;
    const isCloseBelowEma20 = close < ema20Last;

    if (isEmaBullish && isMacdBullish && isRsiBullish && isMomentumBullish && volExpanding && isCloseAboveEma20) {
      direction = "LONG";
      reasoning.push("Momentum LONG Setup Triggered.");
      reasoning.push(`EMA20 ($${ema20Last.toFixed(2)}) is above EMA50 ($${sma50Last.toFixed(2)}).`);
      reasoning.push(`MACD shows bullish crossover. RSI is in trend continuation zone at ${rsiLast.toFixed(1)}.`);
      reasoning.push(`Momentum is positive and accelerating: $${momentum.toFixed(2)}.`);
      reasoning.push("Volatility is expanding, confirming breakout strength.");
    } else if (isEmaBearish && isMacdBearish && isRsiBearish && isMomentumBearish && volExpanding && isCloseBelowEma20) {
      direction = "SHORT";
      reasoning.push("Momentum SHORT Setup Triggered.");
      reasoning.push(`EMA20 ($${ema20Last.toFixed(2)}) is below EMA50 ($${sma50Last.toFixed(2)}).`);
      reasoning.push(`MACD shows bearish crossover. RSI is in breakdown continuation zone at ${rsiLast.toFixed(1)}.`);
      reasoning.push(`Momentum is negative and accelerating: $${momentum.toFixed(2)}.`);
      reasoning.push("Volatility is expanding, confirming breakout strength.");
    } else {
      reasoning.push("No momentum setup detected.");
    }

    // Confidence scoring engine:
    // confidence = trendScore + rsiScore + macdScore + momentumScore + volatilityScore
    let confidence = 0;
    if (direction !== "HOLD") {
      const trendScore = direction === "LONG" ? (ema20Last > sma50Last ? 20 : 5) : (ema20Last < sma50Last ? 20 : 5);
      
      let rsiScore = 5;
      if (direction === "LONG") {
        rsiScore = (rsiLast >= 60 && rsiLast <= 70) ? 20 : 15;
      } else {
        rsiScore = (rsiLast >= 30 && rsiLast <= 40) ? 20 : 15;
      }

      const macdScore = direction === "LONG" ? (macdHist > 0 ? 20 : 10) : (macdHist < 0 ? 20 : 10);
      const momentumScore = direction === "LONG" ? (momentum > prevMomentum ? 20 : 10) : (momentum < prevMomentum ? 20 : 10);
      const volatilityScore = volExpanding ? 20 : 10;

      confidence = trendScore + rsiScore + macdScore + momentumScore + volatilityScore;
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
      indicators.bbUpper !== undefined &&
      indicators.bbUpper.length >= candles.length &&
      indicators.bbMiddle !== undefined &&
      indicators.bbMiddle.length >= candles.length &&
      indicators.bbLower !== undefined &&
      indicators.bbLower.length >= candles.length &&
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

    // Dynamic SL: below EMA50 or recent swing low
    const last5 = candles.slice(-5);
    const last5Lows = last5.map((c) => c.low);
    const last5Highs = last5.map((c) => c.high);
    const swingLow = Math.min(...last5Lows);
    const swingHigh = Math.max(...last5Highs);

    let stopLoss = 0;
    let takeProfit = 0;

    if (direction === "LONG") {
      stopLoss = Math.min(sma50Last, swingLow) - 1.0 * atr;
      if (stopLoss >= close) {
        stopLoss = close - 2.0 * atr; // Fallback
      }
      takeProfit = close + 2.0 * (close - stopLoss); // Dynamic 1:2 RR
    } else if (direction === "SHORT") {
      stopLoss = Math.max(sma50Last, swingHigh) + 1.0 * atr;
      if (stopLoss <= close) {
        stopLoss = close + 2.0 * atr; // Fallback
      }
      takeProfit = close - 2.0 * (stopLoss - close); // Dynamic 1:2 RR
    }

    const signal = SignalGenerator.createSignal(
      this.id,
      direction,
      confidence,
      reasoning,
      context
    );

    // Override custom SL/TP in signal
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
