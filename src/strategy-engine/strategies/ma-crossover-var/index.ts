import { TradingMode, ConsensusCategory, TradingStrategy, StrategyContext, StrategySignal } from "../../types";
import { SignalGenerator } from "../../core/signal-generator";
import { RegimeEngine } from "../../core/regime-engine";

/**
 * MA Crossover Variable Strategy
 *
 * Adaptive trend-following strategy that uses short-term EMA crossovers
 * filtered by the direction of the long-term SMA200 trend.
 *
 * LONG:  EMA20 crosses above EMA50 + price > SMA200 + SMA200 slope positive + EMA20 slope positive
 * SHORT: EMA20 crosses below EMA50 + price < SMA200 + SMA200 slope negative + EMA20 slope negative
 *
 * Filters:
 *   - Reject weak EMA separation (< 0.08% of price)
 *   - Reject flat SMA200 (slope < 0.005%)
 *   - Reject ranging market conditions
 *   - Reject crossover if price is too close to SMA200 (< 0.2%)
 *
 * Stop Loss: Below/above EMA50 or 1.5 × ATR
 * Take Profit: Minimum 2 × ATR, trend-following 3 × ATR
 */
export class MACrossoverVariableStrategy implements TradingStrategy {
  public id = "ma-crossover-var";
  public category: TradingMode = TradingMode.INTRADAY;
  public consensusCategory: ConsensusCategory = ConsensusCategory.INTRADAY;
  public expectedHoldingTime = "1h-8h";
  public name = "MA Crossover Variable";
  public description = "Adaptive trend-following using EMA20/EMA50 crossovers filtered by SMA200 trend and slope.";
  public type = "Trend Following";
  public timeframe = "15m";
  public timeframes = ["15m", "30m", "1h"];
  public symbols: string[] = [];
  public enabled = true;
  public indicatorsRequired = ["ema20", "atr"];
  public supportedRegimes = ["Bullish Trend","Bearish Trend","Breakout","High Volatility"];

  private readonly minEMASeparation = 0.0008; // 0.08% minimum separation
  private readonly minSMA200Slope = 0.005;     // 0.005% minimum slope
  private readonly minSMADistance = 0.002;     // 0.2% minimum price distance from SMA200
  private readonly sma200Period = 200;
  private readonly ema50Period = 50;

  // ────────────────────────────────────────────
  // Internal Indicator Calculators
  // ────────────────────────────────────────────

  private computeEMA(closes: number[], period: number): number[] {
    const ema: number[] = new Array(closes.length).fill(0);
    if (closes.length === 0) return ema;
    const k = 2 / (period + 1);
    ema[0] = closes[0];
    for (let i = 1; i < closes.length; i++) {
      ema[i] = closes[i] * k + ema[i - 1] * (1 - k);
    }
    return ema;
  }

  private computeSMA(closes: number[], period: number): number[] {
    const sma: number[] = new Array(closes.length).fill(0);
    let sum = 0;
    for (let i = 0; i < closes.length; i++) {
      sum += closes[i];
      if (i >= period) sum -= closes[i - period];
      sma[i] = i >= period - 1 ? sum / period : sum / (i + 1);
    }
    return sma;
  }

  // ────────────────────────────────────────────
  // TradingStrategy Interface Implementation
  // ────────────────────────────────────────────

  public analyze(context: StrategyContext): { direction: "LONG" | "SHORT" | "HOLD"; reasoning: string[]; confidence: number } {
    const { candles, indicators } = context;
    const lastIdx = candles.length - 1;
    const close = candles[lastIdx].close;

    const closes = candles.map(c => c.close);
    const ema50 = this.computeEMA(closes, this.ema50Period);
    const sma200 = this.computeSMA(closes, this.sma200Period);
    const ema20 = indicators.ema20;

    const ema20Last = ema20[lastIdx];
    const ema20Prev = ema20[lastIdx - 1];
    const ema50Last = ema50[lastIdx];
    const ema50Prev = ema50[lastIdx - 1];
    const sma200Last = sma200[lastIdx];
    const sma200Prev = sma200[lastIdx - 1];

    // Crossover detection
    const bullishCross = ema20Prev <= ema50Prev && ema20Last > ema50Last;
    const bearishCross = ema20Prev >= ema50Prev && ema20Last < ema50Last;

    // Fresh crossover
    const freshBullishCross = bullishCross;
    const freshBearishCross = bearishCross;

    // SMA200 slope (over 5 candles for stability)
    const sma200_5ago = lastIdx >= 5 ? sma200[lastIdx - 5] : sma200Prev;
    const sma200Slope = sma200Last - sma200_5ago;
    const sma200SlopePercent = sma200_5ago > 0 ? (sma200Slope / sma200_5ago) * 100 : 0;
    const isSma200Flat = Math.abs(sma200SlopePercent) < this.minSMA200Slope;

    // EMA20 slope (over 5 candles)
    const ema20_5ago = lastIdx >= 5 ? ema20[lastIdx - 5] : ema20Prev;
    const ema20Slope = ema20Last - ema20_5ago;

    // Distance checks
    const distFromSma200 = Math.abs(close - sma200Last) / close;
    const isTooCloseToSma200 = distFromSma200 < this.minSMADistance;

    const emaSeparation = Math.abs(ema20Last - ema50Last) / close;
    const isEmaSeparationWeak = emaSeparation < this.minEMASeparation;

    // Regime Check
    const regime = RegimeEngine.classify(context);
    const isRanging = regime === "Ranging" || regime === "Low Volatility";

    let direction: "LONG" | "SHORT" | "HOLD" = "HOLD";
    const reasoning: string[] = [];

    // --- Filters ---
    if (isRanging) {
      reasoning.push(`Ranging market regime detected (${regime}) — avoiding trend trades.`);
      return { direction: "HOLD", reasoning, confidence: 0 };
    }

    if (isSma200Flat) {
      reasoning.push(`SMA200 is flat (slope: ${sma200SlopePercent.toFixed(4)}%) — no clear macro trend.`);
      return { direction: "HOLD", reasoning, confidence: 0 };
    }

    if (isEmaSeparationWeak) {
      reasoning.push(`EMA separation ${(emaSeparation * 100).toFixed(3)}% is below minimum ${(this.minEMASeparation * 100).toFixed(3)}%.`);
      return { direction: "HOLD", reasoning, confidence: 0 };
    }

    if (isTooCloseToSma200) {
      reasoning.push(`Price is too close to SMA200 (distance: ${(distFromSma200 * 100).toFixed(3)}% < ${(this.minSMADistance * 100).toFixed(1)}%).`);
      return { direction: "HOLD", reasoning, confidence: 0 };
    }

    // --- LONG ---
    if (freshBullishCross && close > sma200Last && sma200Slope > 0 && ema20Slope > 0) {
      direction = "LONG";
      reasoning.push("MA Crossover LONG: EMA20 crossed above EMA50.");
      reasoning.push(`Price ($${close.toFixed(2)}) is above SMA200 ($${sma200Last.toFixed(2)}).`);
      reasoning.push(`SMA200 is sloping upwards (${sma200SlopePercent.toFixed(3)}%).`);
      if (bullishCross) reasoning.push("EMA crossover is fresh on the current candle.");
    }

    // --- SHORT ---
    if (direction === "HOLD" && freshBearishCross && close < sma200Last && sma200Slope < 0 && ema20Slope < 0) {
      direction = "SHORT";
      reasoning.push("MA Crossover SHORT: EMA20 crossed below EMA50.");
      reasoning.push(`Price ($${close.toFixed(2)}) is below SMA200 ($${sma200Last.toFixed(2)}).`);
      reasoning.push(`SMA200 is sloping downwards (${sma200SlopePercent.toFixed(3)}%).`);
      if (bearishCross) reasoning.push("EMA crossover is fresh on the current candle.");
    }

    if (direction === "HOLD") {
      if (!freshBullishCross && !freshBearishCross) {
        reasoning.push("No fresh EMA20/EMA50 crossover within the last 5 candles.");
      } else {
        reasoning.push("Crossover occurred but trend alignment with SMA200 or EMA20 slope failed.");
      }
    }

    // --- Confidence scoring ---
    let confidence = 0;
    if (direction !== "HOLD") {
      confidence = 50; // Base

      // Freshness bonus
      if (bullishCross || bearishCross) confidence += 15;
      else confidence += 5;

      // Separation bonus
      if (emaSeparation > 0.003) confidence += 10;
      else if (emaSeparation > 0.0015) confidence += 5;

      // SMA200 slope strength
      if (Math.abs(sma200SlopePercent) > 0.05) confidence += 15;
      else if (Math.abs(sma200SlopePercent) > 0.02) confidence += 10;
      else confidence += 5;

      // Distance from SMA200
      if (distFromSma200 > 0.01) confidence += 10;
      else if (distFromSma200 > 0.005) confidence += 5;

      confidence = Math.min(100, Math.max(0, Math.round(confidence)));
    }

    return { direction, reasoning, confidence };
  }

  public validate(context: StrategyContext): boolean {
    const { candles, indicators } = context;
    return (
      candles.length >= 210 && // SMA200 + buffer
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

    const closes = candles.map(c => c.close);
    const ema50 = this.computeEMA(closes, this.ema50Period);
    const ema50Last = ema50[lastIdx];

    let stopLoss = 0;
    let takeProfit = 0;

    if (direction === "LONG") {
      // Below EMA50 or 1.5 ATR
      const slEma = ema50Last - 0.2 * atr;
      const slAtr = close - 1.5 * atr;
      stopLoss = Math.max(slEma, slAtr);
      if (stopLoss >= close) stopLoss = close - 1.5 * atr;
      takeProfit = close + 3.0 * atr;
    } else if (direction === "SHORT") {
      // Above EMA50 or 1.5 ATR
      const slEma = ema50Last + 0.2 * atr;
      const slAtr = close + 1.5 * atr;
      stopLoss = Math.min(slEma, slAtr);
      if (stopLoss <= close) stopLoss = close + 1.5 * atr;
      takeProfit = close - 3.0 * atr;
    }

    const signal = SignalGenerator.createSignal(this.id, direction, confidence, reasoning, context);

    if (direction !== "HOLD") {
      signal.stopLoss = Number(stopLoss.toFixed(4));
      signal.takeProfit = Number(takeProfit.toFixed(4));
    }

    // Attach computed indicator levels to signal
    const sma200 = this.computeSMA(closes, this.sma200Period);
    signal.indicators = {
      ...signal.indicators,
      ema50: ema50Last,
      sma200: sma200[lastIdx],
    };

    return signal;
  }

  public evaluate(context: StrategyContext): StrategySignal {
    if (!this.enabled || !this.validate(context)) {
      return SignalGenerator.createSignal(
        this.id,
        "HOLD",
        0,
        ["Strategy disabled or validation failed — need 210+ candles and required indicators."],
        context
      );
    }
    return this.generateSignal(context);
  }
}
