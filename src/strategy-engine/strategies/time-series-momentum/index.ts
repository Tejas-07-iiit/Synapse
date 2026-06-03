import { TradingMode, ConsensusCategory, TradingStrategy, StrategyContext, StrategySignal } from "../../types";
import { SignalGenerator } from "../../core/signal-generator";

/**
 * Time Series Momentum Strategy
 *
 * Concept: Pure trend persistence — assets that have moved strongly
 * tend to continue moving in the same direction.
 *
 * Uses Momentum(12) and ADX(14).
 *
 * LONG:  Momentum positive + ADX > 25 + ADX rising
 * SHORT: Momentum negative + ADX > 25 + ADX rising
 *
 * Filter: Reject if ADX < 20 (sideways markets)
 *
 * Stop Loss: 1.5 × ATR
 * Take Profit: 2 × ATR minimum
 */
export class TimeSeriesMomentumStrategy implements TradingStrategy {
  public id = "time-series-momentum";
  public category: TradingMode = TradingMode.INTRADAY;
  public consensusCategory: ConsensusCategory = ConsensusCategory.INTRADAY;
  public expectedHoldingTime = "1h-8h";
  public name = "Time Series Momentum Strategy";
  public description = "Captures trend persistence using 12-period momentum and ADX trend strength filtering.";
  public type = "Momentum";
  public timeframe = "15m";
  public timeframes = ["15m", "30m", "1h"];
  public symbols: string[] = [];
  public enabled = true;
  public indicatorsRequired = ["adx", "momentum", "atr", "rsi"];
  public supportedRegimes = ["Breakout","High Volatility","Bullish Trend","Bearish Trend"];

  private readonly adxThreshold = 25;
  private readonly adxMinimum = 20;    // Below this, market is sideways → reject

  // ────────────────────────────────────────────
  // TradingStrategy interface
  // ────────────────────────────────────────────

  public analyze(context: StrategyContext): { direction: "LONG" | "SHORT" | "HOLD"; reasoning: string[]; confidence: number } {
    const { candles, indicators } = context;
    const lastIdx = candles.length - 1;
    const close = candles[lastIdx].close;

    // Momentum(12) — fallback: compute manually if indicator array is empty
    let momentumLast = 0;
    if (indicators.momentum && indicators.momentum.length >= candles.length) {
      momentumLast = indicators.momentum[lastIdx];
    } else if (lastIdx >= 12) {
      momentumLast = close - candles[lastIdx - 12].close;
    }

    // ADX(14)
    const adxLast = indicators.adx[lastIdx] ?? 0;
    const adxPrev = lastIdx > 0 ? (indicators.adx[lastIdx - 1] ?? 0) : 0;
    const adxRising = adxLast > adxPrev;

    // RSI for supplemental confidence
    const rsiLast = indicators.rsi?.[lastIdx] ?? 50;

    let direction: "LONG" | "SHORT" | "HOLD" = "HOLD";
    const reasoning: string[] = [];

    // --- Filter: ADX too low → sideways market ---
    if (adxLast < this.adxMinimum) {
      reasoning.push(`ADX at ${adxLast.toFixed(1)} is below ${this.adxMinimum} — sideways market detected, no trade.`);
      return { direction: "HOLD", reasoning, confidence: 0 };
    }

    // --- LONG conditions ---
    if (momentumLast > 0 && adxLast > this.adxThreshold && adxRising) {
      direction = "LONG";
      reasoning.push("Time Series Momentum LONG: Positive 12-period momentum with strong, rising trend.");
      reasoning.push(`Momentum: $${momentumLast.toFixed(2)} (positive).`);
      reasoning.push(`ADX: ${adxLast.toFixed(1)} > ${this.adxThreshold} and rising (prev: ${adxPrev.toFixed(1)}).`);
    }

    // --- SHORT conditions ---
    if (direction === "HOLD" && momentumLast < 0 && adxLast > this.adxThreshold && adxRising) {
      direction = "SHORT";
      reasoning.push("Time Series Momentum SHORT: Negative 12-period momentum with strong, rising trend.");
      reasoning.push(`Momentum: $${momentumLast.toFixed(2)} (negative).`);
      reasoning.push(`ADX: ${adxLast.toFixed(1)} > ${this.adxThreshold} and rising (prev: ${adxPrev.toFixed(1)}).`);
    }

    if (direction === "HOLD") {
      if (adxLast <= this.adxThreshold) {
        reasoning.push(`ADX at ${adxLast.toFixed(1)} is below ${this.adxThreshold} threshold — trend not strong enough.`);
      } else if (!adxRising) {
        reasoning.push(`ADX at ${adxLast.toFixed(1)} is not rising (prev: ${adxPrev.toFixed(1)}) — trend weakening.`);
      } else if (momentumLast === 0) {
        reasoning.push("Momentum is flat at zero — no directional bias.");
      }
    }

    // --- Confidence scoring ---
    let confidence = 0;
    if (direction !== "HOLD") {
      confidence = 50; // Base

      // Momentum magnitude (normalized by ATR for comparability)
      const atr = indicators.atr?.[lastIdx] || (close * 0.015);
      const momNorm = atr > 0 ? Math.abs(momentumLast) / atr : 0;
      if (momNorm > 3.0) confidence += 15;
      else if (momNorm > 2.0) confidence += 10;
      else if (momNorm > 1.0) confidence += 5;

      // ADX strength
      if (adxLast > 40) confidence += 15;
      else if (adxLast > 30) confidence += 10;
      else confidence += 5;

      // ADX acceleration (how fast trend is strengthening)
      const adxDelta = adxLast - adxPrev;
      if (adxDelta > 3) confidence += 5;

      // Trend persistence — check momentum over last 3 candles in same direction
      let persistenceCount = 0;
      for (let i = 1; i <= 3 && lastIdx - i >= 12; i++) {
        const prevMom = candles[lastIdx - i].close - candles[lastIdx - i - 12].close;
        if ((direction === "LONG" && prevMom > 0) || (direction === "SHORT" && prevMom < 0)) {
          persistenceCount++;
        }
      }
      if (persistenceCount >= 3) confidence += 10;
      else if (persistenceCount >= 2) confidence += 5;

      // RSI alignment
      if (direction === "LONG" && rsiLast > 50) confidence += 5;
      if (direction === "SHORT" && rsiLast < 50) confidence += 5;

      confidence = Math.min(100, Math.max(0, Math.round(confidence)));
    }

    return { direction, reasoning, confidence };
  }

  public validate(context: StrategyContext): boolean {
    const { candles, indicators } = context;
    return (
      candles.length >= 30 &&
      indicators.adx !== undefined &&
      indicators.adx.length >= candles.length &&
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
