import { TradingMode,  TradingStrategy, StrategyContext, StrategySignal } from "../../types";
import { SignalGenerator } from "../../core/signal-generator";

/**
 * T3 Nexus Strategy
 *
 * Trend-following strategy using the Tillson T3 moving average as a smoother,
 * faster trend detector. Integrates T3 slope, acceleration, and trend persistence.
 *
 * T3 Formula:
 *   e1 = EMA(Close, Length)
 *   e2 = EMA(e1, Length)
 *   e3 = EMA(e2, Length)
 *   e4 = EMA(e3, Length)
 *   e5 = EMA(e4, Length)
 *   e6 = EMA(e5, Length)
 *   c1 = -a^3
 *   c2 = 3*a^2 + 3*a^3
 *   c3 = -6*a^2 - 3*a - 3*a^3
 *   c4 = 1 + 3*a + 3*a^2 + a^3
 *   T3 = c1*e6 + c2*e5 + c3*e4 + c4*e3
 *   (where a = Volume Factor = 0.7)
 *
 * LONG:  Price > T3 + T3 slope positive + T3 acceleration positive
 * SHORT: Price < T3 + T3 slope negative + T3 acceleration negative
 *
 * Filters:
 *   - Reject flat T3 conditions (slope percent < 0.002%)
 *   - Reject low-volatility environments (ATR/price < 0.15%)
 *
 * Stop Loss: Below/above T3 or 1.5 × ATR
 * Take Profit: Dynamic trailing exit, minimum 2 × ATR
 */
export class T3NexusStrategy implements TradingStrategy {
  public id = "t3-nexus";
  public category: TradingMode = TradingMode.INTRADAY;
  public expectedHoldingTime = "1h-8h";
  public name = "T3 Nexus";
  public description = "Trend-following system using the Tillson T3 moving average with slope and acceleration indicators.";
  public type = "Trend Following";
  public timeframe = "15m";
  public timeframes = ["5m", "15m", "1h", "4h"];
  public symbols: string[] = [];
  public enabled = true;
  public indicatorsRequired = ["atr"];
  public supportedRegimes = ["Bullish Trend","Bearish Trend","Breakout","High Volatility"];

  private readonly t3Length = 8;
  private readonly volumeFactor = 0.7;
  private readonly minT3Slope = 0.002;        // 0.002% minimum slope
  private readonly minVolatilityPct = 0.0015; // 0.15% minimum ATR/price

  // ────────────────────────────────────────────
  // Tillson T3 Computation
  // ────────────────────────────────────────────

  private computeEMA(values: number[], period: number): number[] {
    const ema: number[] = new Array(values.length).fill(0);
    if (values.length === 0) return ema;
    const k = 2 / (period + 1);
    ema[0] = values[0];
    for (let i = 1; i < values.length; i++) {
      ema[i] = values[i] * k + ema[i - 1] * (1 - k);
    }
    return ema;
  }

  private computeT3(closes: number[], length: number, volumeFactor: number): number[] {
    const e1 = this.computeEMA(closes, length);
    const e2 = this.computeEMA(e1, length);
    const e3 = this.computeEMA(e2, length);
    const e4 = this.computeEMA(e3, length);
    const e5 = this.computeEMA(e4, length);
    const e6 = this.computeEMA(e5, length);

    const a = volumeFactor;
    const a2 = a * a;
    const a3 = a2 * a;

    const c1 = -a3;
    const c2 = 3 * a2 + 3 * a3;
    const c3 = -6 * a2 - 3 * a - 3 * a3;
    const c4 = 1 + 3 * a + 3 * a2 + a3;

    const t3: number[] = new Array(closes.length).fill(0);
    for (let i = 0; i < closes.length; i++) {
      t3[i] = c1 * e6[i] + c2 * e5[i] + c3 * e4[i] + c4 * e3[i];
    }
    return t3;
  }

  // ────────────────────────────────────────────
  // TradingStrategy Interface Implementation
  // ────────────────────────────────────────────

  public analyze(context: StrategyContext): { direction: "LONG" | "SHORT" | "HOLD"; reasoning: string[]; confidence: number } {
    const { candles, indicators } = context;
    const lastIdx = candles.length - 1;
    const close = candles[lastIdx].close;

    const closes = candles.map(c => c.close);
    const t3 = this.computeT3(closes, this.t3Length, this.volumeFactor);

    const t3Last = t3[lastIdx];
    const t3Prev = t3[lastIdx - 1];
    const t3Prev2 = t3[lastIdx - 2];

    // Slope & Acceleration
    const slopeLast = t3Last - t3Prev;
    const slopePrev = t3Prev - t3Prev2;
    const slopePercent = t3Prev > 0 ? (slopeLast / t3Prev) * 100 : 0;
    
    const accelLast = slopeLast - slopePrev;

    const isT3Flat = Math.abs(slopePercent) < this.minT3Slope;

    // Volatility filter
    const atr = indicators.atr[lastIdx] || (close * 0.015);
    const volatilityPct = close > 0 ? atr / close : 0;
    const isLowVolatility = volatilityPct < this.minVolatilityPct;

    // Trend persistence (consecutive candles price is above/below T3)
    let bullishDuration = 0;
    let bearishDuration = 0;
    for (let i = lastIdx; i >= 0; i--) {
      if (candles[i].close > t3[i]) {
        bullishDuration++;
        bearishDuration = 0;
      } else if (candles[i].close < t3[i]) {
        bearishDuration++;
        bullishDuration = 0;
      } else {
        break;
      }
    }

    let direction: "LONG" | "SHORT" | "HOLD" = "HOLD";
    const reasoning: string[] = [];

    // --- Filters ---
    if (isLowVolatility) {
      reasoning.push(`Low volatility environment (ATR/Price: ${(volatilityPct * 100).toFixed(3)}% < ${(this.minVolatilityPct * 100).toFixed(2)}%).`);
      return { direction: "HOLD", reasoning, confidence: 0 };
    }

    if (isT3Flat) {
      reasoning.push(`T3 Moving Average is flat (slope: ${slopePercent.toFixed(4)}%).`);
      return { direction: "HOLD", reasoning, confidence: 0 };
    }

    // --- LONG ---
    if (close > t3Last && slopeLast > 0 && accelLast > 0) {
      direction = "LONG";
      reasoning.push("T3 Nexus LONG: Price is above the T3 line.");
      reasoning.push(`T3 slope is positive (${slopePercent.toFixed(3)}%).`);
      reasoning.push(`T3 acceleration is positive (${(accelLast / close * 100).toFixed(4)}% price units/candle).`);
      reasoning.push(`Trend persistence: ${bullishDuration} candles above T3.`);
    }

    // --- SHORT ---
    if (direction === "HOLD" && close < t3Last && slopeLast < 0 && accelLast < 0) {
      direction = "SHORT";
      reasoning.push("T3 Nexus SHORT: Price is below the T3 line.");
      reasoning.push(`T3 slope is negative (${slopePercent.toFixed(3)}%).`);
      reasoning.push(`T3 acceleration is negative (${(accelLast / close * 100).toFixed(4)}% price units/candle).`);
      reasoning.push(`Trend persistence: ${bearishDuration} candles below T3.`);
    }

    if (direction === "HOLD") {
      if (close > t3Last) {
        reasoning.push(`Price is above T3, but T3 slope (${slopePercent.toFixed(4)}%) or acceleration is negative.`);
      } else if (close < t3Last) {
        reasoning.push(`Price is below T3, but T3 slope (${slopePercent.toFixed(4)}%) or acceleration is positive.`);
      } else {
        reasoning.push("Price is crossing T3 without established slope or acceleration.");
      }
    }

    // --- Confidence scoring ---
    let confidence = 0;
    if (direction !== "HOLD") {
      confidence = 55; // Base for trend detection

      // Distance from T3
      const distFromT3 = Math.abs(close - t3Last) / close;
      if (distFromT3 > 0.015) confidence += 15;
      else if (distFromT3 > 0.008) confidence += 10;
      else confidence += 5;

      // Slope strength
      if (Math.abs(slopePercent) > 0.08) confidence += 15;
      else if (Math.abs(slopePercent) > 0.04) confidence += 10;
      else confidence += 5;

      // Acceleration strength
      const normAccel = Math.abs(accelLast) / close;
      if (normAccel > 0.0005) confidence += 10;
      else confidence += 5;

      // Trend persistence
      const duration = direction === "LONG" ? bullishDuration : bearishDuration;
      if (duration >= 7) confidence += 10;
      else confidence += 5;

      confidence = Math.min(100, Math.max(0, Math.round(confidence)));
    }

    return { direction, reasoning, confidence };
  }

  public validate(context: StrategyContext): boolean {
    const { candles, indicators } = context;
    return (
      candles.length >= 40 && // stabilize the T3 cascade
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

    const closes = candles.map(c => c.close);
    const t3 = this.computeT3(closes, this.t3Length, this.volumeFactor);
    const t3Last = t3[lastIdx];

    let stopLoss = 0;
    let takeProfit = 0;

    if (direction === "LONG") {
      const slT3 = t3Last - 0.2 * atr;
      const slAtr = close - 1.5 * atr;
      stopLoss = Math.max(slT3, slAtr);
      if (stopLoss >= close) stopLoss = close - 1.5 * atr;
      takeProfit = close + 3.0 * atr;
    } else if (direction === "SHORT") {
      const slT3 = t3Last + 0.2 * atr;
      const slAtr = close + 1.5 * atr;
      stopLoss = Math.min(slT3, slAtr);
      if (stopLoss <= close) stopLoss = close + 1.5 * atr;
      takeProfit = close - 3.0 * atr;
    }

    const signal = SignalGenerator.createSignal(this.id, direction, confidence, reasoning, context);

    if (direction !== "HOLD") {
      signal.stopLoss = Number(stopLoss.toFixed(4));
      signal.takeProfit = Number(takeProfit.toFixed(4));
    }

    // Attach computed Tillson T3 indicator value
    signal.indicators = {
      ...signal.indicators,
      t3: t3Last,
    };

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
