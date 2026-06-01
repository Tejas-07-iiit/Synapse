import { TradingStrategy, StrategyContext, StrategySignal } from "../../types";
import { SignalGenerator } from "../../core/signal-generator";

/**
 * Hyper Supertrend Strategy
 *
 * Dual Supertrend confirmation system using two parameter sets:
 *   - Supertrend(10, 2) — fast, more responsive
 *   - Supertrend(12, 3) — slow, more reliable
 *
 * LONG:  Both Supertrends bullish + price above both
 * SHORT: Both Supertrends bearish + price below both
 *
 * Filter: Reject conflicting signals, reject flip-flop behaviour
 *
 * Stop Loss: Below the slower Supertrend level
 * Take Profit: Trend-following dynamic trailing
 */
export class HyperSupertrendStrategy implements TradingStrategy {
  public id = "hyper-supertrend";
  public name = "Hyper Supertrend Strategy";
  public description = "Dual Supertrend confirmation system requiring both fast (10,2) and slow (12,3) Supertrends to align for high-conviction trend signals.";
  public type = "Trend Following";
  public timeframe = "15m";
  public timeframes = ["5m", "15m", "1h", "4h"];
  public symbols: string[] = [];
  public enabled = true;
  public indicatorsRequired = ["atr"];
  public supportedRegimes = ["Bullish Trend","Bearish Trend","Breakout","High Volatility"];

  // ────────────────────────────────────────────
  // Supertrend computation
  // ────────────────────────────────────────────

  /**
   * Computes the Supertrend indicator.
   * Returns { supertrend: number[], direction: number[] }
   * direction[i] = 1 (bullish / uptrend) or -1 (bearish / downtrend)
   */
  private computeSupertrend(
    candles: { high: number; low: number; close: number }[],
    period: number,
    multiplier: number
  ): { supertrend: number[]; direction: number[] } {
    const len = candles.length;
    const st: number[] = new Array(len).fill(0);
    const dir: number[] = new Array(len).fill(1);

    if (len < period + 1) return { supertrend: st, direction: dir };

    // Calculate ATR internally for Supertrend (needed with specific period)
    const tr: number[] = new Array(len).fill(0);
    tr[0] = candles[0].high - candles[0].low;
    for (let i = 1; i < len; i++) {
      const hl = candles[i].high - candles[i].low;
      const hc = Math.abs(candles[i].high - candles[i - 1].close);
      const lc = Math.abs(candles[i].low - candles[i - 1].close);
      tr[i] = Math.max(hl, hc, lc);
    }

    // ATR with Wilder's smoothing
    const atr: number[] = new Array(len).fill(0);
    let trSum = 0;
    for (let i = 0; i < Math.min(period, len); i++) trSum += tr[i];
    atr[period - 1] = trSum / period;
    for (let i = period; i < len; i++) {
      atr[i] = (atr[i - 1] * (period - 1) + tr[i]) / period;
    }
    // Fill early values
    for (let i = 0; i < period - 1; i++) atr[i] = atr[period - 1];

    // Upper and Lower bands
    const upperBand: number[] = new Array(len).fill(0);
    const lowerBand: number[] = new Array(len).fill(0);

    for (let i = 0; i < len; i++) {
      const hl2 = (candles[i].high + candles[i].low) / 2;
      upperBand[i] = hl2 + multiplier * atr[i];
      lowerBand[i] = hl2 - multiplier * atr[i];
    }

    // Final Supertrend
    const finalUpper: number[] = [...upperBand];
    const finalLower: number[] = [...lowerBand];

    for (let i = 1; i < len; i++) {
      // Final Upper Band
      if (finalUpper[i] < finalUpper[i - 1] || candles[i - 1].close > finalUpper[i - 1]) {
        // keep finalUpper[i]
      } else {
        finalUpper[i] = finalUpper[i - 1];
      }

      // Final Lower Band
      if (finalLower[i] > finalLower[i - 1] || candles[i - 1].close < finalLower[i - 1]) {
        // keep finalLower[i]
      } else {
        finalLower[i] = finalLower[i - 1];
      }
    }

    // Direction and Supertrend value
    // Start with direction = 1 (uptrend)
    st[0] = finalLower[0];
    dir[0] = 1;

    for (let i = 1; i < len; i++) {
      if (dir[i - 1] === 1) {
        // Was uptrend
        if (candles[i].close < finalLower[i]) {
          // Switch to downtrend
          dir[i] = -1;
          st[i] = finalUpper[i];
        } else {
          dir[i] = 1;
          st[i] = finalLower[i];
        }
      } else {
        // Was downtrend
        if (candles[i].close > finalUpper[i]) {
          // Switch to uptrend
          dir[i] = 1;
          st[i] = finalLower[i];
        } else {
          dir[i] = -1;
          st[i] = finalUpper[i];
        }
      }
    }

    return { supertrend: st, direction: dir };
  }

  // ────────────────────────────────────────────
  // TradingStrategy interface
  // ────────────────────────────────────────────

  public analyze(context: StrategyContext): { direction: "LONG" | "SHORT" | "HOLD"; reasoning: string[]; confidence: number } {
    const { candles, indicators } = context;
    const lastIdx = candles.length - 1;
    const close = candles[lastIdx].close;

    // Compute dual Supertrends
    const fast = this.computeSupertrend(candles, 10, 2);
    const slow = this.computeSupertrend(candles, 12, 3);

    const fastDir = fast.direction[lastIdx];
    const slowDir = slow.direction[lastIdx];
    const fastSt = fast.supertrend[lastIdx];
    const slowSt = slow.supertrend[lastIdx];

    const fastPrevDir = fast.direction[lastIdx - 1];
    const slowPrevDir = slow.direction[lastIdx - 1];

    // Both aligned
    const bothBullish = fastDir === 1 && slowDir === 1;
    const bothBearish = fastDir === -1 && slowDir === -1;
    const conflicting = fastDir !== slowDir;

    // Price above/below both Supertrend levels
    const aboveBoth = close > fastSt && close > slowSt;
    const belowBoth = close < fastSt && close < slowSt;

    // Flip-flop detection (direction changed in last 3 candles for either)
    let flipFlopCount = 0;
    for (let i = 1; i <= 3 && lastIdx - i > 0; i++) {
      if (fast.direction[lastIdx - i] !== fast.direction[lastIdx - i - 1]) flipFlopCount++;
      if (slow.direction[lastIdx - i] !== slow.direction[lastIdx - i - 1]) flipFlopCount++;
    }
    const isFlipFlop = flipFlopCount >= 3;

    // Trend duration (how long both have been aligned)
    let trendDuration = 0;
    for (let i = lastIdx; i >= 1; i--) {
      if (fast.direction[i] === fastDir && slow.direction[i] === slowDir) {
        trendDuration++;
      } else {
        break;
      }
    }

    let direction: "LONG" | "SHORT" | "HOLD" = "HOLD";
    const reasoning: string[] = [];

    // --- Filters ---
    if (conflicting) {
      reasoning.push(`Supertrend conflict: Fast=${fastDir === 1 ? "Bullish" : "Bearish"}, Slow=${slowDir === 1 ? "Bullish" : "Bearish"}.`);
      return { direction: "HOLD", reasoning, confidence: 0 };
    }

    if (isFlipFlop) {
      reasoning.push("Supertrend flip-flop detected — choppy market, avoiding trade.");
      return { direction: "HOLD", reasoning, confidence: 0 };
    }

    // --- LONG ---
    if (bothBullish && aboveBoth) {
      direction = "LONG";
      reasoning.push("Hyper Supertrend LONG: Both fast (10,2) and slow (12,3) Supertrends are bullish.");
      reasoning.push(`Price ($${close.toFixed(2)}) is above both ST levels (fast: $${fastSt.toFixed(2)}, slow: $${slowSt.toFixed(2)}).`);
      reasoning.push(`Trend aligned for ${trendDuration} candles.`);
    }

    // --- SHORT ---
    if (direction === "HOLD" && bothBearish && belowBoth) {
      direction = "SHORT";
      reasoning.push("Hyper Supertrend SHORT: Both fast (10,2) and slow (12,3) Supertrends are bearish.");
      reasoning.push(`Price ($${close.toFixed(2)}) is below both ST levels (fast: $${fastSt.toFixed(2)}, slow: $${slowSt.toFixed(2)}).`);
      reasoning.push(`Trend aligned for ${trendDuration} candles.`);
    }

    if (direction === "HOLD" && reasoning.length === 0) {
      reasoning.push("Hyper Supertrend: Price not decisively above/below both Supertrend levels.");
    }

    // --- Confidence scoring ---
    let confidence = 0;
    if (direction !== "HOLD") {
      confidence = 55; // Base for dual alignment

      // Fresh alignment (just aligned in last 2 candles)
      const justAligned = (fastPrevDir !== fastDir || slowPrevDir !== slowDir);
      if (justAligned) confidence += 10;

      // Trend persistence
      if (trendDuration > 10) confidence += 15;
      else if (trendDuration > 5) confidence += 10;
      else confidence += 5;

      // Distance from Supertrend (normalized by ATR)
      const atr = indicators.atr[lastIdx] || (close * 0.015);
      const distFast = Math.abs(close - fastSt) / atr;
      const distSlow = Math.abs(close - slowSt) / atr;
      if (distFast > 1.0 && distSlow > 1.0) confidence += 10;
      else if (distFast > 0.5) confidence += 5;

      confidence = Math.min(100, Math.max(0, Math.round(confidence)));
    }

    return { direction, reasoning, confidence };
  }

  public validate(context: StrategyContext): boolean {
    const { candles, indicators } = context;
    return (
      candles.length >= 30 &&
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

    const slow = this.computeSupertrend(candles, 12, 3);
    const slowSt = slow.supertrend[lastIdx];

    let stopLoss = 0;
    let takeProfit = 0;

    if (direction === "LONG") {
      stopLoss = slowSt - 0.5 * atr; // Below slower Supertrend
      if (stopLoss >= close) stopLoss = close - 2.0 * atr;
      takeProfit = close + 2.5 * atr;
    } else if (direction === "SHORT") {
      stopLoss = slowSt + 0.5 * atr; // Above slower Supertrend
      if (stopLoss <= close) stopLoss = close + 2.0 * atr;
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
      return SignalGenerator.createSignal(this.id, "HOLD", 0, ["Strategy disabled or validation failed due to insufficient data."], context);
    }
    return this.generateSignal(context);
  }
}
