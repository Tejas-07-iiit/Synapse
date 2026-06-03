import { TradingMode, ConsensusCategory, TradingStrategy, StrategyContext, StrategySignal } from "../../types";
import { SignalGenerator } from "../../core/signal-generator";

/**
 * Golden Cross Strategy
 *
 * Institutional trend-following strategy that identifies major trend reversals
 * using SMA50/SMA200 moving average crossovers.
 *
 * LONG:  SMA50 crosses above SMA200 + price > SMA200 + SMA200 slope positive
 * SHORT: SMA50 crosses below SMA200 + price < SMA200 + SMA200 slope negative
 *
 * Filter: Ignore flat SMA200, weak crossovers, require separation > 0.5%
 *
 * Stop Loss: Below SMA200 or 2 × ATR
 * Take Profit: Trend-following 3 × ATR
 */
export class GoldenCrossStrategy implements TradingStrategy {
  public id = "golden-cross";
  public category: TradingMode = TradingMode.INTRADAY;
  public consensusCategory: ConsensusCategory = ConsensusCategory.SWING;
  public expectedHoldingTime = "1h-8h";
  public name = "Golden Cross Strategy";
  public description = "Institutional trend-following using SMA50/SMA200 crossovers for major trend reversal identification.";
  public type = "Trend Following";
  public timeframe = "15m";
  public timeframes = ["15m", "30m", "1h"];
  public symbols: string[] = [];
  public enabled = true;
  public indicatorsRequired = ["sma50", "atr", "rsi"];
  public supportedRegimes = ["Bullish Trend","Bearish Trend","Breakout","High Volatility"];

  private readonly minSeparation = 0.005; // 0.5% minimum SMA separation
  private readonly sma200Period = 200;

  // ────────────────────────────────────────────
  // Internal helpers
  // ────────────────────────────────────────────

  /**
   * Computes SMA200 from close prices since it's not in default indicators.
   */
  private computeSMA200(closes: number[]): number[] {
    const period = this.sma200Period;
    const result: number[] = new Array(closes.length).fill(0);
    let sum = 0;

    for (let i = 0; i < closes.length; i++) {
      sum += closes[i];
      if (i >= period) sum -= closes[i - period];
      result[i] = i >= period - 1 ? sum / period : sum / (i + 1);
    }
    return result;
  }

  // ────────────────────────────────────────────
  // TradingStrategy interface
  // ────────────────────────────────────────────

  public analyze(context: StrategyContext): { direction: "LONG" | "SHORT" | "HOLD"; reasoning: string[]; confidence: number } {
    const { candles, indicators } = context;
    const lastIdx = candles.length - 1;
    const close = candles[lastIdx].close;

    const closes = candles.map(c => c.close);
    const sma200 = this.computeSMA200(closes);
    const sma50 = indicators.sma50;

    const sma50Last = sma50[lastIdx];
    const sma50Prev = sma50[lastIdx - 1];
    const sma200Last = sma200[lastIdx];
    const sma200Prev = sma200[lastIdx - 1];

    // SMA200 slope (over 5 candles for stability)
    const sma200_5ago = lastIdx >= 5 ? sma200[lastIdx - 5] : sma200Prev;
    const sma200Slope = sma200Last - sma200_5ago;
    const sma200SlopePercent = sma200_5ago > 0 ? (sma200Slope / sma200_5ago) * 100 : 0;
    const isSma200Flat = Math.abs(sma200SlopePercent) < 0.01;

    // Crossover detection
    const bullishCross = sma50Prev <= sma200Prev && sma50Last > sma200Last;
    const bearishCross = sma50Prev >= sma200Prev && sma50Last < sma200Last;

    // Fresh crossover
    const freshBullishCross = bullishCross;
    const freshBearishCross = bearishCross;

    // SMA separation
    const separation = close > 0 ? Math.abs(sma50Last - sma200Last) / close : 0;
    const hasMinSeparation = separation >= this.minSeparation;

    let direction: "LONG" | "SHORT" | "HOLD" = "HOLD";
    const reasoning: string[] = [];

    // --- Filters ---
    if (isSma200Flat) {
      reasoning.push(`SMA200 is flat (slope: ${sma200SlopePercent.toFixed(4)}%) — no clear macro trend.`);
      return { direction: "HOLD", reasoning, confidence: 0 };
    }

    // --- LONG: Golden Cross ---
    if (freshBullishCross && close > sma200Last && sma200Slope > 0 && hasMinSeparation) {
      direction = "LONG";
      reasoning.push("Golden Cross LONG: SMA50 crossed above SMA200.");
      reasoning.push(`Price ($${close.toFixed(2)}) is above SMA200 ($${sma200Last.toFixed(2)}).`);
      reasoning.push(`SMA200 slope is positive (${sma200SlopePercent.toFixed(3)}%).`);
      reasoning.push(`SMA separation: ${(separation * 100).toFixed(3)}%.`);
      if (bullishCross) reasoning.push("Crossover is fresh (same candle).");
    }

    // --- SHORT: Death Cross ---
    if (direction === "HOLD" && freshBearishCross && close < sma200Last && sma200Slope < 0 && hasMinSeparation) {
      direction = "SHORT";
      reasoning.push("Death Cross SHORT: SMA50 crossed below SMA200.");
      reasoning.push(`Price ($${close.toFixed(2)}) is below SMA200 ($${sma200Last.toFixed(2)}).`);
      reasoning.push(`SMA200 slope is negative (${sma200SlopePercent.toFixed(3)}%).`);
      reasoning.push(`SMA separation: ${(separation * 100).toFixed(3)}%.`);
      if (bearishCross) reasoning.push("Crossover is fresh (same candle).");
    }

    if (direction === "HOLD") {
      if (!freshBullishCross && !freshBearishCross) {
        reasoning.push("No SMA50/SMA200 crossover detected recently.");
      } else if (!hasMinSeparation) {
        reasoning.push(`SMA separation ${(separation * 100).toFixed(3)}% below ${(this.minSeparation * 100).toFixed(1)}% minimum.`);
      }
    }

    // --- Confidence scoring ---
    let confidence = 0;
    if (direction !== "HOLD") {
      confidence = 50;

      // Freshness bonus
      if (bullishCross || bearishCross) confidence += 15;
      else confidence += 5;

      // SMA separation
      if (separation > 0.02) confidence += 15;
      else if (separation > 0.01) confidence += 10;
      else confidence += 5;

      // SMA200 slope strength
      if (Math.abs(sma200SlopePercent) > 0.1) confidence += 10;
      else if (Math.abs(sma200SlopePercent) > 0.05) confidence += 5;

      // Price distance from SMA200
      const priceDistPercent = sma200Last > 0 ? Math.abs(close - sma200Last) / sma200Last : 0;
      if (priceDistPercent > 0.02) confidence += 5;

      confidence = Math.min(100, Math.max(0, Math.round(confidence)));
    }

    return { direction, reasoning, confidence };
  }

  public validate(context: StrategyContext): boolean {
    const { candles, indicators } = context;
    return (
      candles.length >= 210 && // SMA200 + buffer
      indicators.sma50 !== undefined &&
      indicators.sma50.length >= candles.length &&
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
    const sma200 = this.computeSMA200(closes);
    const sma200Last = sma200[lastIdx];

    let stopLoss = 0;
    let takeProfit = 0;

    if (direction === "LONG") {
      const slSma = sma200Last - 0.5 * atr;
      const slAtr = close - 2.0 * atr;
      stopLoss = Math.max(slSma, slAtr);
      if (stopLoss >= close) stopLoss = close - 2.0 * atr;
      takeProfit = close + 3.0 * atr;
    } else if (direction === "SHORT") {
      const slSma = sma200Last + 0.5 * atr;
      const slAtr = close + 2.0 * atr;
      stopLoss = Math.min(slSma, slAtr);
      if (stopLoss <= close) stopLoss = close + 2.0 * atr;
      takeProfit = close - 3.0 * atr;
    }

    const signal = SignalGenerator.createSignal(this.id, direction, confidence, reasoning, context);

    if (direction !== "HOLD") {
      signal.stopLoss = Number(stopLoss.toFixed(4));
      signal.takeProfit = Number(takeProfit.toFixed(4));
    }

    signal.indicators = { ...signal.indicators, sma200: sma200Last };

    return signal;
  }

  public evaluate(context: StrategyContext): StrategySignal {
    if (!this.enabled || !this.validate(context)) {
      return SignalGenerator.createSignal(this.id, "HOLD", 0, ["Strategy disabled or validation failed — need 210+ candles for SMA200."], context);
    }
    return this.generateSignal(context);
  }
}
