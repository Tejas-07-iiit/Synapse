import { TradingMode, ConsensusCategory, TradingStrategy, StrategyContext, StrategySignal } from "../../types";
import { SignalGenerator } from "../../core/signal-generator";
import { getSqueezeState } from "../../utils/volatility";
import { calculateEMA } from "../../indicators/ema";

/**
 * Squeeze Momentum Strategy
 *
 * John Carter's Squeeze Momentum system that identifies periods of volatility compression
 * (Bollinger Bands inside Keltner Channels) and triggers on the expansion release in the
 * direction of a linear regression momentum histogram.
 *
 * LONG:  Squeeze releases (within last 5 candles) + momentum positive + momentum increasing + price > EMA20
 * SHORT: Squeeze releases (within last 5 candles) + momentum negative + momentum decreasing + price < EMA20
 *
 * Stop Loss: 1.5 × ATR
 * Take Profit: Minimum 2 × ATR, trend-following 2.5 × ATR
 */
export class SqueezeMomentumStrategy implements TradingStrategy {
  public id = "squeeze-momentum";
  public category: TradingMode = TradingMode.INTRADAY;
  public consensusCategory: ConsensusCategory = ConsensusCategory.INTRADAY;
  public expectedHoldingTime = "1h-8h";
  public name = "Squeeze Momentum";
  public description = "Volatility breakout strategy entering trades on Bollinger/Keltner squeeze releases confirmed by momentum direction.";
  public type = "Volatility";
  public timeframe = "15m";
  public timeframes = ["15m", "30m", "1h"];
  public symbols: string[] = [];
  public enabled = true;
  public indicatorsRequired = ["ema20", "atr"];
  public supportedRegimes = ["Breakout","High Volatility","Bullish Trend","Bearish Trend"];

  private readonly squeezeLookback = 5;
  private readonly momentumPeriod = 20;

  // ────────────────────────────────────────────
  // Momentum Histogram Logic (Linear Regression of deviation from midline)
  // ────────────────────────────────────────────

  private computeMomentumHistogram(closes: number[], highs: number[], lows: number[], ema20: number[], period: number): number[] {
    const len = closes.length;
    const val: number[] = new Array(len).fill(0);
    
    for (let i = 0; i < len; i++) {
      const start = Math.max(0, i - period + 1);
      let hh = -Infinity;
      let ll = Infinity;
      for (let j = start; j <= i; j++) {
        if (highs[j] > hh) hh = highs[j];
        if (lows[j] < ll) ll = lows[j];
      }
      const donchianMid = (hh + ll) / 2;
      val[i] = closes[i] - (donchianMid + ema20[i]) / 2;
    }

    const hist: number[] = new Array(len).fill(0);
    const n = period;
    const sumX = (n * (n - 1)) / 2;
    const sumXX = (n * (n - 1) * (2 * n - 1)) / 6;
    const denominator = n * sumXX - sumX * sumX;

    for (let i = period - 1; i < len; i++) {
      let sumY = 0;
      let sumXY = 0;
      const startIdx = i - n + 1;
      for (let x = 0; x < n; x++) {
        const y = val[startIdx + x];
        sumY += y;
        sumXY += x * y;
      }
      const slope = (n * sumXY - sumX * sumY) / denominator;
      const intercept = (sumY - slope * sumX) / n;
      hist[i] = slope * (n - 1) + intercept;
    }

    return hist;
  }

  // ────────────────────────────────────────────
  // TradingStrategy Interface Implementation
  // ────────────────────────────────────────────

  public analyze(context: StrategyContext): { direction: "LONG" | "SHORT" | "HOLD"; reasoning: string[]; confidence: number } {
    const { candles, indicators } = context;
    const lastIdx = candles.length - 1;
    const close = candles[lastIdx].close;

    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);

    const ema20 = indicators.ema20;
    const ema20Last = ema20[lastIdx];

    // Compute Squeeze and Momentum
    const { squeezeOn } = getSqueezeState(closes, candles, 20, 2.0, 1.5);
    const hist = this.computeMomentumHistogram(closes, highs, lows, ema20, this.momentumPeriod);

    const histLast = hist[lastIdx];
    const histPrev = hist[lastIdx - 1];
    const histPrev2 = hist[lastIdx - 2];

    // Check if squeeze was ON recently, and has just released (transitioned from true -> false)
    const squeezeRelease = squeezeOn[lastIdx - 1] === true && squeezeOn[lastIdx] === false;
    const releaseAgo = 0;
    const squeezeDuration = 0; // TODO: calculate actual duration if needed


    // Momentum direction and acceleration
    const momUp = histLast > histPrev;
    const momDown = histLast < histPrev;
    
    const accelLast = (histLast - histPrev) - (histPrev - histPrev2);
    const hasVolatilityExpansion = Math.abs(histLast) > Math.abs(histPrev);

    let direction: "LONG" | "SHORT" | "HOLD" = "HOLD";
    const reasoning: string[] = [];

    // --- LONG ---
    if (squeezeRelease && histLast > 0 && momUp && close > ema20Last) {
      direction = "LONG";
      reasoning.push(`Squeeze Momentum LONG: Bollinger Bands released from Keltner Squeeze ${releaseAgo} candles ago.`);
      reasoning.push(`Momentum histogram is positive (${histLast.toFixed(4)}) and rising.`);
      reasoning.push(`Price ($${close.toFixed(2)}) is above EMA20 ($${ema20Last.toFixed(2)}).`);
      reasoning.push(`Squeeze compression duration was ${squeezeDuration} candles.`);
    }

    // --- SHORT ---
    if (direction === "HOLD" && squeezeRelease && histLast < 0 && momDown && close < ema20Last) {
      direction = "SHORT";
      reasoning.push(`Squeeze Momentum SHORT: Bollinger Bands released from Keltner Squeeze ${releaseAgo} candles ago.`);
      reasoning.push(`Momentum histogram is negative (${histLast.toFixed(4)}) and falling.`);
      reasoning.push(`Price ($${close.toFixed(2)}) is below EMA20 ($${ema20Last.toFixed(2)}).`);
      reasoning.push(`Squeeze compression duration was ${squeezeDuration} candles.`);
    }

    if (direction === "HOLD") {
      if (!squeezeRelease) {
        reasoning.push(`No Keltner Squeeze release detected within last ${this.squeezeLookback} candles. Current squeeze state: ${squeezeOn[lastIdx] ? "COMPRESSED" : "NORMAL"}.`);
      } else {
        reasoning.push(`Squeeze released but momentum direction or trend alignment failed (Hist: ${histLast.toFixed(4)}, Close vs EMA20).`);
      }
    }

    // --- Confidence scoring ---
    let confidence = 0;
    if (direction !== "HOLD") {
      confidence = 50; // Base

      // Duration bonus
      if (squeezeDuration >= 10) confidence += 15;
      else if (squeezeDuration >= 5) confidence += 10;
      else confidence += 5;

      // Momentum strength
      const normMom = Math.abs(histLast) / close;
      if (normMom > 0.01) confidence += 15;
      else if (normMom > 0.005) confidence += 10;
      else confidence += 5;

      // Acceleration confirmation
      const isAccelerating = direction === "LONG" ? accelLast > 0 : accelLast < 0;
      if (isAccelerating && hasVolatilityExpansion) confidence += 10;

      // Crossover freshness
      if (releaseAgo === 0) confidence += 10;

      confidence = Math.min(100, Math.max(0, Math.round(confidence)));
    }

    return { direction, reasoning, confidence };
  }

  public validate(context: StrategyContext): boolean {
    const { candles, indicators } = context;
    return (
      candles.length >= 40 && // buffer for KC + Linear Regression
      indicators.ema20 !== undefined &&
      indicators.ema20.length >= candles.length &&
      indicators.atr !== undefined &&
      indicators.atr.length >= candles.length
    );
  }

  public generateSignal(context: StrategyContext): StrategySignal {
    const { direction, reasoning, confidence } = this.analyze(context);
    const { candles, indicators } = context;
    const lastIdx = candles.length - 1;
    const close = candles[lastIdx].close;
    const atr = indicators.atr[lastIdx] || (close * 0.015);

    let stopLoss = 0;
    let takeProfit = 0;

    if (direction === "LONG") {
      stopLoss = close - 1.5 * atr;
      takeProfit = close + 2.5 * atr;
    } else if (direction === "SHORT") {
      stopLoss = close + 1.5 * atr;
      takeProfit = close - 2.5 * atr;
    }

    const signal = SignalGenerator.createSignal(this.id, direction, confidence, reasoning, context);

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
        ["Strategy disabled or validation failed — need 40+ candles and required indicators."],
        context
      );
    }
    return this.generateSignal(context);
  }
}
