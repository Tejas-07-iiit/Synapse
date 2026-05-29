import { TradingStrategy, StrategyContext, StrategySignal } from "../../types";
import { SignalGenerator } from "../../core/signal-generator";

/**
 * Heiken Ashi Swing Strategy
 *
 * Trend-following strategy using Heiken Ashi candle transformations
 * combined with ATR expansion to capture swing trades.
 *
 * HA Formulas:
 *   HA Close = (O + H + L + C) / 4
 *   HA Open  = (prev HA Open + prev HA Close) / 2
 *   HA High  = max(H, HA Open, HA Close)
 *   HA Low   = min(L, HA Open, HA Close)
 *
 * LONG:  Red→Green flip + 2 consecutive bullish HA + ATR expanding
 * SHORT: Green→Red flip + 2 consecutive bearish HA + ATR expanding
 *
 * Stop Loss: Previous swing low/high
 * Take Profit: Dynamic trailing (2.5 × ATR)
 */
export class HeikenAshiSwingStrategy implements TradingStrategy {
  public id = "heiken-ashi-swing";
  public name = "Heiken Ashi Swing Strategy";
  public description = "Trend-following using Heiken Ashi candle transformations with ATR expansion for swing trade capture.";
  public type = "Trend Following";
  public timeframe = "15m";
  public timeframes = ["5m", "15m", "1h", "4h"];
  public symbols: string[] = [];
  public enabled = true;
  public indicatorsRequired = ["atr"];

  private readonly minBodyRatio = 0.3; // Minimum body/range ratio to filter doji candles

  // ────────────────────────────────────────────
  // Heiken Ashi computation
  // ────────────────────────────────────────────

  private computeHeikenAshi(candles: { open: number; high: number; low: number; close: number }[]): {
    haOpen: number[]; haClose: number[]; haHigh: number[]; haLow: number[];
  } {
    const len = candles.length;
    const haOpen: number[] = new Array(len).fill(0);
    const haClose: number[] = new Array(len).fill(0);
    const haHigh: number[] = new Array(len).fill(0);
    const haLow: number[] = new Array(len).fill(0);

    if (len === 0) return { haOpen, haClose, haHigh, haLow };

    // First candle
    haClose[0] = (candles[0].open + candles[0].high + candles[0].low + candles[0].close) / 4;
    haOpen[0] = (candles[0].open + candles[0].close) / 2;
    haHigh[0] = Math.max(candles[0].high, haOpen[0], haClose[0]);
    haLow[0] = Math.min(candles[0].low, haOpen[0], haClose[0]);

    for (let i = 1; i < len; i++) {
      haClose[i] = (candles[i].open + candles[i].high + candles[i].low + candles[i].close) / 4;
      haOpen[i] = (haOpen[i - 1] + haClose[i - 1]) / 2;
      haHigh[i] = Math.max(candles[i].high, haOpen[i], haClose[i]);
      haLow[i] = Math.min(candles[i].low, haOpen[i], haClose[i]);
    }

    return { haOpen, haClose, haHigh, haLow };
  }

  // ────────────────────────────────────────────
  // TradingStrategy interface
  // ────────────────────────────────────────────

  public analyze(context: StrategyContext): { direction: "LONG" | "SHORT" | "HOLD"; reasoning: string[]; confidence: number } {
    const { candles, indicators } = context;
    const lastIdx = candles.length - 1;
    const close = candles[lastIdx].close;

    const { haOpen, haClose, haHigh, haLow } = this.computeHeikenAshi(candles);

    // HA candle properties
    const isBullish = (i: number) => haClose[i] > haOpen[i];
    const isBearish = (i: number) => haClose[i] < haOpen[i];

    const bodySize = (i: number) => Math.abs(haClose[i] - haOpen[i]);
    const range = (i: number) => haHigh[i] - haLow[i] || 1;
    const bodyRatio = (i: number) => bodySize(i) / range(i);

    // Current and previous candle states
    const currBullish = isBullish(lastIdx);
    const prevBullish = isBullish(lastIdx - 1);
    const prev2Bullish = lastIdx >= 2 ? isBullish(lastIdx - 2) : prevBullish;

    const currBearish = isBearish(lastIdx);
    const prevBearish = isBearish(lastIdx - 1);
    const prev2Bearish = lastIdx >= 2 ? isBearish(lastIdx - 2) : prevBearish;

    // Color flip detection
    const greenFlip = currBullish && !prevBullish; // Red → Green
    const redFlip = currBearish && !prevBearish;   // Green → Red

    // Consecutive candles (looking back from current)
    const twoBullish = currBullish && prevBullish;
    const twoBearish = currBearish && prevBearish;

    // ATR expansion
    const atrLast = indicators.atr[lastIdx] || (close * 0.015);
    const atrPrev = lastIdx > 0 ? (indicators.atr[lastIdx - 1] || atrLast) : atrLast;
    const atrExpanding = atrLast > atrPrev;

    // Strong body check (filter doji candles)
    const currBodyRatio = bodyRatio(lastIdx);
    const prevBodyRatio = bodyRatio(lastIdx - 1);
    const hasStrongBody = currBodyRatio >= this.minBodyRatio && prevBodyRatio >= this.minBodyRatio;

    // Low ATR filter
    const avgAtr5 = (() => {
      let sum = 0;
      for (let i = Math.max(0, lastIdx - 4); i <= lastIdx; i++) sum += indicators.atr[i] || 0;
      return sum / Math.min(5, lastIdx + 1);
    })();
    const isLowAtr = close > 0 ? (avgAtr5 / close) < 0.002 : false; // < 0.2% of price

    let direction: "LONG" | "SHORT" | "HOLD" = "HOLD";
    const reasoning: string[] = [];

    // --- Filters ---
    if (isLowAtr) {
      reasoning.push("ATR too low — low volatility environment, skipping.");
      return { direction: "HOLD", reasoning, confidence: 0 };
    }

    if (!hasStrongBody) {
      reasoning.push(`Doji-like candles detected (body ratio: ${currBodyRatio.toFixed(2)}) — weak structure.`);
      // Don't return; still check for strong setups below
    }

    // --- LONG: Red → Green flip + 2 bullish + ATR expanding + strong body ---
    if ((greenFlip || twoBullish) && atrExpanding && hasStrongBody) {
      direction = "LONG";
      if (greenFlip) {
        reasoning.push("Heiken Ashi LONG: Red → Green color flip detected.");
      }
      if (twoBullish) {
        reasoning.push("Two consecutive bullish HA candles confirm trend.");
      }
      reasoning.push(`ATR expanding (${atrLast.toFixed(4)} > ${atrPrev.toFixed(4)}).`);
      reasoning.push(`Candle body ratio: ${currBodyRatio.toFixed(2)} (strong body).`);
    }

    // --- SHORT: Green → Red flip + 2 bearish + ATR expanding + strong body ---
    if (direction === "HOLD" && (redFlip || twoBearish) && atrExpanding && hasStrongBody) {
      direction = "SHORT";
      if (redFlip) {
        reasoning.push("Heiken Ashi SHORT: Green → Red color flip detected.");
      }
      if (twoBearish) {
        reasoning.push("Two consecutive bearish HA candles confirm trend.");
      }
      reasoning.push(`ATR expanding (${atrLast.toFixed(4)} > ${atrPrev.toFixed(4)}).`);
      reasoning.push(`Candle body ratio: ${currBodyRatio.toFixed(2)} (strong body).`);
    }

    if (direction === "HOLD" && reasoning.length === 0) {
      reasoning.push("Heiken Ashi: No valid color flip or consecutive candle pattern detected.");
    }

    // --- Confidence scoring ---
    let confidence = 0;
    if (direction !== "HOLD") {
      confidence = 50;

      // Color flip freshness
      if (greenFlip || redFlip) confidence += 15;

      // Consecutive candle sequence
      if (twoBullish || twoBearish) confidence += 10;
      const threeConsecutive = direction === "LONG"
        ? (currBullish && prevBullish && prev2Bullish)
        : (currBearish && prevBearish && prev2Bearish);
      if (threeConsecutive) confidence += 5;

      // ATR expansion strength
      const atrExpansion = atrPrev > 0 ? (atrLast - atrPrev) / atrPrev : 0;
      if (atrExpansion > 0.15) confidence += 10;
      else if (atrExpansion > 0.05) confidence += 5;

      // Body dominance (larger body = stronger conviction)
      if (currBodyRatio > 0.7) confidence += 10;
      else if (currBodyRatio > 0.5) confidence += 5;

      confidence = Math.min(100, Math.max(0, Math.round(confidence)));
    }

    return { direction, reasoning, confidence };
  }

  public validate(context: StrategyContext): boolean {
    const { candles, indicators } = context;
    return (
      candles.length >= 20 &&
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

    // Find previous swing low/high for SL
    const lookback = Math.min(10, lastIdx);
    const recentLows = candles.slice(lastIdx - lookback, lastIdx).map(c => c.low);
    const recentHighs = candles.slice(lastIdx - lookback, lastIdx).map(c => c.high);
    const swingLow = Math.min(...recentLows);
    const swingHigh = Math.max(...recentHighs);

    let stopLoss = 0;
    let takeProfit = 0;

    if (direction === "LONG") {
      stopLoss = Math.max(swingLow - 0.5 * atr, close - 2.0 * atr);
      if (stopLoss >= close) stopLoss = close - 2.0 * atr;
      takeProfit = close + 2.5 * atr;
    } else if (direction === "SHORT") {
      stopLoss = Math.min(swingHigh + 0.5 * atr, close + 2.0 * atr);
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
