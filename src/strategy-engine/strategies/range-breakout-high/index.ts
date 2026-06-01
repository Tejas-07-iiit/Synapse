import { TradingStrategy, StrategyContext, StrategySignal } from "../../types";
import { SignalGenerator } from "../../core/signal-generator";

/**
 * Range Breakout High Strategy
 *
 * Concept: Detect price consolidation using a rolling Donchian Channel,
 * then trigger on breakouts confirmed by a volume spike.
 *
 * LONG:  Price breaks above Donchian upper + volume > 1.5× MA + tight range
 * SHORT: Price breaks below Donchian lower + volume > 1.5× MA + tight range
 *
 * Filter: Reject if range is too wide (no compression detected).
 *
 * Stop Loss: 1.5 × ATR
 * Take Profit: 2 × ATR minimum
 */
export class RangeBreakoutHighStrategy implements TradingStrategy {
  public id = "range-breakout-high";
  public name = "Range Breakout High Strategy";
  public description = "Detects consolidation ranges via Donchian Channels and triggers on breakouts with volume confirmation.";
  public type = "Breakout";
  public timeframe = "15m";
  public timeframes = ["5m", "15m", "1h", "4h"];
  public symbols: string[] = [];
  public enabled = true;
  public indicatorsRequired = ["atr", "bbUpper", "bbMiddle", "bbLower", "volumeMA"];
  public supportedRegimes = ["Breakout","High Volatility","Bullish Trend","Bearish Trend"];

  private readonly donchianPeriod = 20;
  private readonly rangeThreshold = 0.03;  // 3% of price — tight range cutoff
  private readonly volumeSpikeRatio = 1.5; // Volume must be 1.5× the MA

  // ────────────────────────────────────────────
  // Internal helpers
  // ────────────────────────────────────────────

  /**
   * Computes Donchian Channel upper, lower, middle for the last N candles
   * ending at `endIdx` (inclusive).
   */
  private computeDonchian(
    candles: { high: number; low: number }[],
    endIdx: number,
    period: number
  ): { upper: number; lower: number; middle: number } {
    const startIdx = Math.max(0, endIdx - period + 1);
    let highest = -Infinity;
    let lowest = Infinity;

    for (let i = startIdx; i <= endIdx; i++) {
      if (candles[i].high > highest) highest = candles[i].high;
      if (candles[i].low < lowest) lowest = candles[i].low;
    }

    return {
      upper: highest,
      lower: lowest,
      middle: (highest + lowest) / 2,
    };
  }

  // ────────────────────────────────────────────
  // TradingStrategy interface
  // ────────────────────────────────────────────

  public analyze(context: StrategyContext): { direction: "LONG" | "SHORT" | "HOLD"; reasoning: string[]; confidence: number } {
    const { candles, indicators } = context;
    const lastIdx = candles.length - 1;
    const close = candles[lastIdx].close;
    const high = candles[lastIdx].high;
    const low = candles[lastIdx].low;
    const volume = candles[lastIdx].volume;

    // Calculate Donchian on the lookback window BEFORE the current candle
    // (so a break of the range is meaningful)
    const prevDonchian = this.computeDonchian(candles, lastIdx - 1, this.donchianPeriod);

    const rangeWidth = prevDonchian.upper - prevDonchian.lower;
    const rangePercent = close > 0 ? rangeWidth / close : 0;
    const isTightRange = rangePercent < this.rangeThreshold;

    // Volume confirmation
    const volumeMA = indicators.volumeMA?.[lastIdx] || 1;
    const volumeRatio = volumeMA > 0 ? volume / volumeMA : 1;
    const hasVolSpike = volumeRatio >= this.volumeSpikeRatio;

    // ATR for reference
    const atr = indicators.atr[lastIdx] || (close * 0.015);

    let direction: "LONG" | "SHORT" | "HOLD" = "HOLD";
    const reasoning: string[] = [];

    // --- LONG: Price breaks above the prior Donchian upper ---
    if (high > prevDonchian.upper && close > prevDonchian.upper && isTightRange && hasVolSpike) {
      direction = "LONG";
      reasoning.push(`Breakout LONG: Price ($${close.toFixed(2)}) broke above Donchian upper ($${prevDonchian.upper.toFixed(2)}).`);
      reasoning.push(`Range was tight at ${(rangePercent * 100).toFixed(2)}% (threshold: ${(this.rangeThreshold * 100).toFixed(1)}%).`);
      reasoning.push(`Volume spike confirmed: ${volumeRatio.toFixed(2)}× average.`);
    }

    // --- SHORT: Price breaks below the prior Donchian lower ---
    if (direction === "HOLD" && low < prevDonchian.lower && close < prevDonchian.lower && isTightRange && hasVolSpike) {
      direction = "SHORT";
      reasoning.push(`Breakout SHORT: Price ($${close.toFixed(2)}) broke below Donchian lower ($${prevDonchian.lower.toFixed(2)}).`);
      reasoning.push(`Range was tight at ${(rangePercent * 100).toFixed(2)}% (threshold: ${(this.rangeThreshold * 100).toFixed(1)}%).`);
      reasoning.push(`Volume spike confirmed: ${volumeRatio.toFixed(2)}× average.`);
    }

    // --- Rejection reasons ---
    if (direction === "HOLD") {
      if (!isTightRange) {
        reasoning.push(`No range compression: range width ${(rangePercent * 100).toFixed(2)}% exceeds ${(this.rangeThreshold * 100).toFixed(1)}% threshold.`);
      } else if (!hasVolSpike) {
        reasoning.push(`No volume spike: volume ratio ${volumeRatio.toFixed(2)}× below ${this.volumeSpikeRatio}× threshold.`);
      } else {
        reasoning.push("Price remains within the Donchian range — no breakout detected.");
      }
    }

    // --- Confidence scoring ---
    let confidence = 0;
    if (direction !== "HOLD") {
      confidence = 55; // Base for valid breakout

      // Tighter range = stronger compression = higher confidence
      if (rangePercent < 0.015) confidence += 15;
      else if (rangePercent < 0.02) confidence += 10;
      else confidence += 5;

      // Stronger volume spike
      if (volumeRatio >= 2.5) confidence += 15;
      else if (volumeRatio >= 2.0) confidence += 10;
      else confidence += 5;

      // Close decisively beyond the range (not just a wick)
      const breakDistance = direction === "LONG"
        ? (close - prevDonchian.upper) / atr
        : (prevDonchian.lower - close) / atr;
      if (breakDistance > 0.5) confidence += 10;
      if (breakDistance > 1.0) confidence += 5;

      confidence = Math.min(100, Math.max(0, Math.round(confidence)));
    }

    return { direction, reasoning, confidence };
  }

  public validate(context: StrategyContext): boolean {
    const { candles, indicators } = context;
    return (
      candles.length >= 30 &&
      indicators.atr !== undefined &&
      indicators.atr.length >= candles.length &&
      indicators.volumeMA !== undefined &&
      indicators.volumeMA.length >= candles.length
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
      takeProfit = close + 2.0 * atr;
    } else if (direction === "SHORT") {
      stopLoss = close + 1.5 * atr;
      takeProfit = close - 2.0 * atr;
    }

    const signal = SignalGenerator.createSignal(
      this.id,
      direction,
      confidence,
      reasoning,
      context
    );

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
        ["Strategy disabled or validation failed due to insufficient indicator data."],
        context
      );
    }
    return this.generateSignal(context);
  }
}
