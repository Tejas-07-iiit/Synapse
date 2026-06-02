import { TradingMode,  TradingStrategy, StrategyContext, StrategySignal } from "../../types";
import { SignalGenerator } from "../../core/signal-generator";

/**
 * Residual Momentum Strategy
 *
 * Concept: Compute residual returns (actual return minus a simple linear-regression predicted return)
 * and trade when the z-score of the residual is statistically significant.
 *
 * LONG:  z-score > 1.5 + RSI > 50 + price above EMA20
 * SHORT: z-score < −1.5 + RSI < 50 + price below EMA20
 *
 * Stop Loss: 1.5 × ATR
 * Take Profit: 2:1 RR
 */
export class ResidualMomentumStrategy implements TradingStrategy {
  public id = "residual-momentum";
  public category: TradingMode = TradingMode.SCALPING;
  public expectedHoldingTime = "5m-45m";
  public name = "Residual Momentum Strategy";
  public description = "Measures abnormal (residual) returns versus a regression baseline and trades on statistically significant momentum deviations.";
  public type = "Momentum";
  public timeframe = "1m";
  public timeframes = ["1m", "3m", "5m"];
  public symbols: string[] = [];
  public enabled = true;
  public indicatorsRequired = ["rsi", "ema20", "sma50", "atr"];
  public supportedRegimes = ["Breakout","High Volatility","Bullish Trend","Bearish Trend"];

  private readonly regressionPeriod = 20;
  private readonly zScoreThreshold = 1.5;

  // ────────────────────────────────────────────
  // Internal helpers
  // ────────────────────────────────────────────

  /**
   * Simple linear regression on `y` values (0-indexed x).
   * Returns { slope, intercept, predicted[] }
   */
  private linearRegression(y: number[]): { slope: number; intercept: number; predicted: number[] } {
    const n = y.length;
    if (n === 0) return { slope: 0, intercept: 0, predicted: [] };

    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += y[i];
      sumXY += i * y[i];
      sumXX += i * i;
    }

    const denom = n * sumXX - sumX * sumX;
    const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
    const intercept = (sumY - slope * sumX) / n;

    const predicted = new Array(n);
    for (let i = 0; i < n; i++) {
      predicted[i] = intercept + slope * i;
    }

    return { slope, intercept, predicted };
  }

  /**
   * Computes z-score of the latest residual over a rolling window.
   */
  private computeResidualZScore(closes: number[], endIdx: number): { zScore: number; residual: number } {
    const period = this.regressionPeriod;
    if (endIdx < period) return { zScore: 0, residual: 0 };

    // Calculate log returns
    const logReturns: number[] = [];
    const start = endIdx - period;
    for (let i = start + 1; i <= endIdx; i++) {
      const ret = closes[i - 1] > 0 ? Math.log(closes[i] / closes[i - 1]) : 0;
      logReturns.push(ret);
    }

    // Linear regression on log returns
    const { predicted } = this.linearRegression(logReturns);

    // Residuals
    const residuals: number[] = [];
    for (let i = 0; i < logReturns.length; i++) {
      residuals.push(logReturns[i] - predicted[i]);
    }

    // Mean and std dev of residuals
    const mean = residuals.reduce((a, b) => a + b, 0) / residuals.length;
    const variance = residuals.reduce((a, b) => a + (b - mean) * (b - mean), 0) / residuals.length;
    const stdDev = Math.sqrt(variance);

    const latestResidual = residuals[residuals.length - 1];
    const zScore = stdDev > 0 ? (latestResidual - mean) / stdDev : 0;

    return { zScore, residual: latestResidual };
  }

  // ────────────────────────────────────────────
  // TradingStrategy interface
  // ────────────────────────────────────────────

  public analyze(context: StrategyContext): { direction: "LONG" | "SHORT" | "HOLD"; reasoning: string[]; confidence: number } {
    const { candles, indicators } = context;
    const lastIdx = candles.length - 1;
    const close = candles[lastIdx].close;
    const closes = candles.map((c) => c.close);

    const { zScore, residual } = this.computeResidualZScore(closes, lastIdx);

    const rsiLast = indicators.rsi[lastIdx];
    const ema20Last = indicators.ema20[lastIdx];
    const sma50Last = indicators.sma50[lastIdx];

    let direction: "LONG" | "SHORT" | "HOLD" = "HOLD";
    const reasoning: string[] = [];

    // --- LONG conditions ---
    if (zScore > this.zScoreThreshold && rsiLast > 50 && close > ema20Last) {
      direction = "LONG";
      reasoning.push(`Residual Momentum LONG: z-score ${zScore.toFixed(2)} exceeds +${this.zScoreThreshold} threshold.`);
      reasoning.push(`Abnormal positive residual return: ${(residual * 100).toFixed(3)}%.`);
      reasoning.push(`RSI ${rsiLast.toFixed(1)} > 50 and price above EMA20 ($${ema20Last.toFixed(2)}) confirm bullish alignment.`);
    }

    // --- SHORT conditions ---
    if (direction === "HOLD" && zScore < -this.zScoreThreshold && rsiLast < 50 && close < ema20Last) {
      direction = "SHORT";
      reasoning.push(`Residual Momentum SHORT: z-score ${zScore.toFixed(2)} below −${this.zScoreThreshold} threshold.`);
      reasoning.push(`Abnormal negative residual return: ${(residual * 100).toFixed(3)}%.`);
      reasoning.push(`RSI ${rsiLast.toFixed(1)} < 50 and price below EMA20 ($${ema20Last.toFixed(2)}) confirm bearish alignment.`);
    }

    if (direction === "HOLD") {
      reasoning.push(`Residual Momentum: z-score at ${zScore.toFixed(2)} is within ±${this.zScoreThreshold} — no abnormal momentum detected.`);
    }

    // --- Confidence scoring ---
    let confidence = 0;
    if (direction !== "HOLD") {
      confidence = 50; // Base

      // z-score magnitude
      const absZ = Math.abs(zScore);
      if (absZ > 2.5) confidence += 20;
      else if (absZ > 2.0) confidence += 15;
      else confidence += 10;

      // Trend alignment — price vs EMA20 vs SMA50
      if (direction === "LONG" && ema20Last > sma50Last) confidence += 10;
      else if (direction === "SHORT" && ema20Last < sma50Last) confidence += 10;

      // RSI strength
      if (direction === "LONG" && rsiLast > 55) confidence += 5;
      if (direction === "LONG" && rsiLast > 60) confidence += 5;
      if (direction === "SHORT" && rsiLast < 45) confidence += 5;
      if (direction === "SHORT" && rsiLast < 40) confidence += 5;

      confidence = Math.min(100, Math.max(0, Math.round(confidence)));
    }

    return { direction, reasoning, confidence };
  }

  public validate(context: StrategyContext): boolean {
    const { candles, indicators } = context;
    return (
      candles.length >= 30 &&
      indicators.rsi !== undefined &&
      indicators.rsi.length >= candles.length &&
      indicators.ema20 !== undefined &&
      indicators.ema20.length >= candles.length &&
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

    let stopLoss = 0;
    let takeProfit = 0;

    if (direction === "LONG") {
      stopLoss = close - 1.5 * atr;
      const risk = close - stopLoss;
      takeProfit = close + 2.0 * risk; // 2:1 RR
    } else if (direction === "SHORT") {
      stopLoss = close + 1.5 * atr;
      const risk = stopLoss - close;
      takeProfit = close - 2.0 * risk; // 2:1 RR
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
