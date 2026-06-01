import { TradingStrategy, StrategyContext, StrategySignal } from "../../types";
import { SignalGenerator } from "../../core/signal-generator";

/**
 * Parabolic RSI Strategy
 *
 * Concept: Instead of applying Parabolic SAR to price, apply it to RSI(14) values.
 * This detects momentum trend reversals inside RSI itself.
 *
 * LONG:  RSI SAR flips bullish + RSI > 50 + RSI slope positive
 * SHORT: RSI SAR flips bearish + RSI < 50 + RSI slope negative
 *
 * Stop Loss: 1.5 × ATR
 * Take Profit: 2:1 Risk-Reward minimum
 */
export class ParabolicRSIStrategy implements TradingStrategy {
  public id = "parabolic-rsi";
  public name = "Parabolic RSI Strategy";
  public description = "Applies Parabolic SAR logic to RSI values to detect momentum trend reversals within the oscillator.";
  public type = "Momentum";
  public timeframe = "15m";
  public timeframes = ["5m", "15m", "1h", "4h"];
  public symbols: string[] = [];
  public enabled = true;
  public indicatorsRequired = ["rsi", "atr"];
  public supportedRegimes = ["Breakout","High Volatility","Bullish Trend","Bearish Trend"];

  // ────────────────────────────────────────────
  // Parabolic SAR on RSI — internal helper
  // ────────────────────────────────────────────

  /**
   * Applies the Parabolic SAR algorithm to a numeric series (RSI values).
   * Returns { sar: number[], trend: number[] } where trend[i] = 1 (bullish) or -1 (bearish).
   */
  private computeParabolicSAR(
    values: number[],
    afStep: number = 0.02,
    afMax: number = 0.2
  ): { sar: number[]; trend: number[] } {
    const len = values.length;
    const sar: number[] = new Array(len).fill(0);
    const trend: number[] = new Array(len).fill(1);

    if (len < 3) return { sar, trend };

    // Initialise with first two values
    let isUpTrend = values[1] >= values[0];
    let af = afStep;
    let ep = isUpTrend ? values[1] : values[0]; // Extreme point
    sar[0] = isUpTrend ? values[0] : values[1];
    sar[1] = sar[0];
    trend[0] = isUpTrend ? 1 : -1;
    trend[1] = trend[0];

    for (let i = 2; i < len; i++) {
      const prevSar = sar[i - 1];

      // Compute new SAR candidate
      let newSar = prevSar + af * (ep - prevSar);

      if (isUpTrend) {
        // SAR must not be above the two prior lows (in RSI terms, the two prior values)
        newSar = Math.min(newSar, values[i - 1], values[i - 2]);

        if (values[i] < newSar) {
          // Trend reversal → bearish
          isUpTrend = false;
          newSar = ep; // Reset SAR to the last extreme point
          ep = values[i];
          af = afStep;
        } else {
          if (values[i] > ep) {
            ep = values[i];
            af = Math.min(af + afStep, afMax);
          }
        }
      } else {
        // SAR must not be below the two prior highs
        newSar = Math.max(newSar, values[i - 1], values[i - 2]);

        if (values[i] > newSar) {
          // Trend reversal → bullish
          isUpTrend = true;
          newSar = ep;
          ep = values[i];
          af = afStep;
        } else {
          if (values[i] < ep) {
            ep = values[i];
            af = Math.min(af + afStep, afMax);
          }
        }
      }

      sar[i] = newSar;
      trend[i] = isUpTrend ? 1 : -1;
    }

    return { sar, trend };
  }

  // ────────────────────────────────────────────
  // TradingStrategy interface
  // ────────────────────────────────────────────

  public analyze(context: StrategyContext): { direction: "LONG" | "SHORT" | "HOLD"; reasoning: string[]; confidence: number } {
    const { candles, indicators } = context;
    const lastIdx = candles.length - 1;
    const rsiValues = indicators.rsi;

    // --- Parabolic SAR on RSI ---
    const { trend } = this.computeParabolicSAR(rsiValues, 0.02, 0.2);

    const currentTrend = trend[lastIdx];
    const prevTrend = trend[lastIdx - 1];
    const sarFlipBullish = currentTrend === 1 && prevTrend === -1;
    const sarFlipBearish = currentTrend === -1 && prevTrend === 1;

    const rsiLast = rsiValues[lastIdx];
    const rsiPrev = rsiValues[lastIdx - 1];
    const rsiSlope = rsiLast - rsiPrev;

    // Optional: RSI acceleration (second derivative)
    const rsiPrevPrev = lastIdx >= 2 ? rsiValues[lastIdx - 2] : rsiPrev;
    const rsiAcceleration = rsiSlope - (rsiPrev - rsiPrevPrev);

    let direction: "LONG" | "SHORT" | "HOLD" = "HOLD";
    const reasoning: string[] = [];

    // --- LONG conditions ---
    const bullishFlipOrTrend = sarFlipBullish || currentTrend === 1;
    if (bullishFlipOrTrend && rsiLast > 50 && rsiSlope > 0) {
      direction = "LONG";
      if (sarFlipBullish) {
        reasoning.push("Parabolic RSI SAR just flipped bullish — momentum reversal detected.");
      } else {
        reasoning.push("Parabolic RSI SAR is in bullish trend continuation.");
      }
      reasoning.push(`RSI at ${rsiLast.toFixed(1)} is above 50 with positive slope (${rsiSlope.toFixed(2)}).`);
    }

    // --- SHORT conditions ---
    const bearishFlipOrTrend = sarFlipBearish || currentTrend === -1;
    if (direction === "HOLD" && bearishFlipOrTrend && rsiLast < 50 && rsiSlope < 0) {
      direction = "SHORT";
      if (sarFlipBearish) {
        reasoning.push("Parabolic RSI SAR just flipped bearish — momentum reversal detected.");
      } else {
        reasoning.push("Parabolic RSI SAR is in bearish trend continuation.");
      }
      reasoning.push(`RSI at ${rsiLast.toFixed(1)} is below 50 with negative slope (${rsiSlope.toFixed(2)}).`);
    }

    if (direction === "HOLD") {
      reasoning.push("Parabolic RSI: No clear momentum reversal or trend setup detected.");
    }

    // --- Confidence scoring ---
    let confidence = 0;
    if (direction !== "HOLD") {
      // Base: 50 for a valid setup
      confidence = 50;

      // Fresh SAR flip is stronger than continuation
      if (sarFlipBullish || sarFlipBearish) confidence += 15;

      // RSI strength
      if (direction === "LONG") {
        if (rsiLast > 60) confidence += 10;
        if (rsiLast > 70) confidence += 5; // very strong, but careful of overbought
      } else {
        if (rsiLast < 40) confidence += 10;
        if (rsiLast < 30) confidence += 5;
      }

      // RSI acceleration (strong momentum building)
      if ((direction === "LONG" && rsiAcceleration > 0) || (direction === "SHORT" && rsiAcceleration < 0)) {
        confidence += 10;
        reasoning.push("RSI acceleration confirms increasing momentum.");
      }

      // Slope magnitude
      const absSlope = Math.abs(rsiSlope);
      if (absSlope > 3) confidence += 5;
      if (absSlope > 6) confidence += 5;

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
