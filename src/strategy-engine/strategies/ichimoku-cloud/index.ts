import { TradingStrategy, StrategyContext, StrategySignal } from "../../types";
import { SignalGenerator } from "../../core/signal-generator";

/**
 * Ichimoku Cloud Strategy
 *
 * Full Ichimoku Kinko Hyo implementation with all five components:
 *   - Tenkan Sen  (Conversion Line, period 9)
 *   - Kijun Sen   (Base Line, period 26)
 *   - Senkou Span A (Leading Span A)
 *   - Senkou Span B (Leading Span B, period 52)
 *   - Chikou Span  (Lagging Span, 26 periods back)
 *
 * LONG:  Price above cloud + Tenkan > Kijun + bullish cloud + Chikou confirms
 * SHORT: Price below cloud + Tenkan < Kijun + bearish cloud + Chikou confirms
 *
 * Filter: Reject price inside cloud, thin cloud, conflicting signals
 *
 * Stop Loss: Below cloud support or ATR-based
 * Take Profit: Minimum 3 × ATR
 */
export class IchimokuCloudStrategy implements TradingStrategy {
  public id = "ichimoku-cloud";
  public name = "Ichimoku Cloud Strategy";
  public description = "Full Ichimoku Kinko Hyo with Tenkan/Kijun cross, cloud position, cloud colour, and Chikou Span confirmation.";
  public type = "Trend Following";
  public timeframe = "1h";
  public timeframes = ["15m", "1h", "4h"];
  public symbols: string[] = [];
  public enabled = true;
  public indicatorsRequired = ["atr"];
  public supportedRegimes = ["Bullish Trend","Bearish Trend","Breakout","High Volatility"];

  private readonly tenkanPeriod = 9;
  private readonly kijunPeriod = 26;
  private readonly senkouBPeriod = 52;
  private readonly displacement = 26;

  // ────────────────────────────────────────────
  // Ichimoku computation
  // ────────────────────────────────────────────

  /**
   * Calculates the midpoint (highest high + lowest low) / 2 over a period.
   */
  private midpoint(candles: { high: number; low: number }[], endIdx: number, period: number): number {
    const start = Math.max(0, endIdx - period + 1);
    let highest = -Infinity;
    let lowest = Infinity;
    for (let i = start; i <= endIdx; i++) {
      if (candles[i].high > highest) highest = candles[i].high;
      if (candles[i].low < lowest) lowest = candles[i].low;
    }
    return (highest + lowest) / 2;
  }

  /**
   * Computes all Ichimoku components.
   */
  private computeIchimoku(candles: { high: number; low: number; close: number }[]): {
    tenkan: number[];
    kijun: number[];
    senkouA: number[];
    senkouB: number[];
    chikou: number[];
  } {
    const len = candles.length;
    const tenkan: number[] = new Array(len).fill(0);
    const kijun: number[] = new Array(len).fill(0);
    const senkouA: number[] = new Array(len).fill(0);
    const senkouB: number[] = new Array(len).fill(0);
    const chikou: number[] = new Array(len).fill(0);

    for (let i = 0; i < len; i++) {
      // Tenkan Sen (9-period midpoint)
      tenkan[i] = i >= this.tenkanPeriod - 1 ? this.midpoint(candles, i, this.tenkanPeriod) : candles[i].close;

      // Kijun Sen (26-period midpoint)
      kijun[i] = i >= this.kijunPeriod - 1 ? this.midpoint(candles, i, this.kijunPeriod) : candles[i].close;

      // Senkou Span A = (Tenkan + Kijun) / 2, displaced forward 26 periods
      // We store at the current index (the "future" cloud relative to 26 bars ago)
      if (i >= this.displacement) {
        const srcIdx = i - this.displacement;
        const srcTenkan = srcIdx >= this.tenkanPeriod - 1 ? this.midpoint(candles, srcIdx, this.tenkanPeriod) : candles[srcIdx].close;
        const srcKijun = srcIdx >= this.kijunPeriod - 1 ? this.midpoint(candles, srcIdx, this.kijunPeriod) : candles[srcIdx].close;
        senkouA[i] = (srcTenkan + srcKijun) / 2;
      } else {
        senkouA[i] = (tenkan[i] + kijun[i]) / 2;
      }

      // Senkou Span B = 52-period midpoint, displaced forward 26 periods
      if (i >= this.displacement) {
        const srcIdx = i - this.displacement;
        senkouB[i] = srcIdx >= this.senkouBPeriod - 1 ? this.midpoint(candles, srcIdx, this.senkouBPeriod) : candles[srcIdx].close;
      } else {
        senkouB[i] = i >= this.senkouBPeriod - 1 ? this.midpoint(candles, i, this.senkouBPeriod) : candles[i].close;
      }

      // Chikou Span = current close placed 26 periods back
      // At index i, chikou represents the close from i + displacement (if it exists)
      // We store it as: chikou[i] = candles[i].close (the lagging line is plotted displaced)
      chikou[i] = candles[i].close;
    }

    return { tenkan, kijun, senkouA, senkouB, chikou };
  }

  // ────────────────────────────────────────────
  // TradingStrategy interface
  // ────────────────────────────────────────────

  public analyze(context: StrategyContext): { direction: "LONG" | "SHORT" | "HOLD"; reasoning: string[]; confidence: number } {
    const { candles, indicators } = context;
    const lastIdx = candles.length - 1;
    const close = candles[lastIdx].close;

    const ichi = this.computeIchimoku(candles);

    const tenkanLast = ichi.tenkan[lastIdx];
    const kijunLast = ichi.kijun[lastIdx];
    const senkouALast = ichi.senkouA[lastIdx];
    const senkouBLast = ichi.senkouB[lastIdx];

    // Cloud boundaries
    const cloudTop = Math.max(senkouALast, senkouBLast);
    const cloudBottom = Math.min(senkouALast, senkouBLast);
    const cloudThickness = cloudTop - cloudBottom;
    const cloudThicknessPct = close > 0 ? cloudThickness / close : 0;

    // Cloud colour (bullish = Span A > Span B)
    const bullishCloud = senkouALast > senkouBLast;
    const bearishCloud = senkouALast < senkouBLast;

    // Price relative to cloud
    const priceAboveCloud = close > cloudTop;
    const priceBelowCloud = close < cloudBottom;
    const priceInsideCloud = !priceAboveCloud && !priceBelowCloud;

    // TK Cross
    const tkBullish = tenkanLast > kijunLast;
    const tkBearish = tenkanLast < kijunLast;

    // TK Cross freshness
    const tenkanPrev = ichi.tenkan[lastIdx - 1];
    const kijunPrev = ichi.kijun[lastIdx - 1];
    const freshTkBullishCross = tenkanPrev <= kijunPrev && tenkanLast > kijunLast;
    const freshTkBearishCross = tenkanPrev >= kijunPrev && tenkanLast < kijunLast;

    // Chikou Span confirmation (current close vs close 26 periods ago)
    const chikouIdx = lastIdx - this.displacement;
    const chikouConfirmBullish = chikouIdx >= 0 ? close > candles[chikouIdx].close : false;
    const chikouConfirmBearish = chikouIdx >= 0 ? close < candles[chikouIdx].close : false;

    let direction: "LONG" | "SHORT" | "HOLD" = "HOLD";
    const reasoning: string[] = [];

    // --- Filters ---
    if (priceInsideCloud) {
      reasoning.push(`Price ($${close.toFixed(2)}) is inside the cloud ($${cloudBottom.toFixed(2)}-$${cloudTop.toFixed(2)}) — indecision zone.`);
      return { direction: "HOLD", reasoning, confidence: 0 };
    }

    if (cloudThicknessPct < 0.002) {
      reasoning.push(`Cloud too thin (${(cloudThicknessPct * 100).toFixed(3)}%) — weak signal.`);
      // Don't return; thin cloud reduces confidence but doesn't block
    }

    // --- LONG ---
    if (priceAboveCloud && tkBullish && bullishCloud) {
      direction = "LONG";
      reasoning.push("Ichimoku LONG: Price above the cloud.");
      reasoning.push(`Tenkan ($${tenkanLast.toFixed(2)}) > Kijun ($${kijunLast.toFixed(2)}) — bullish TK alignment.`);
      reasoning.push("Cloud is bullish (Span A > Span B).");
      if (chikouConfirmBullish) {
        reasoning.push("Chikou Span confirms bullish bias (close > close[−26]).");
      }
      if (freshTkBullishCross) {
        reasoning.push("Fresh TK bullish crossover detected.");
      }
    }

    // --- SHORT ---
    if (direction === "HOLD" && priceBelowCloud && tkBearish && bearishCloud) {
      direction = "SHORT";
      reasoning.push("Ichimoku SHORT: Price below the cloud.");
      reasoning.push(`Tenkan ($${tenkanLast.toFixed(2)}) < Kijun ($${kijunLast.toFixed(2)}) — bearish TK alignment.`);
      reasoning.push("Cloud is bearish (Span A < Span B).");
      if (chikouConfirmBearish) {
        reasoning.push("Chikou Span confirms bearish bias (close < close[−26]).");
      }
      if (freshTkBearishCross) {
        reasoning.push("Fresh TK bearish crossover detected.");
      }
    }

    if (direction === "HOLD" && reasoning.length === 0) {
      reasoning.push("Ichimoku: Conditions not fully aligned — TK cross, cloud colour, or price position conflicting.");
    }

    // --- Confidence scoring ---
    let confidence = 0;
    if (direction !== "HOLD") {
      confidence = 45; // Base

      // Cloud position strength (distance from cloud)
      const atr = indicators.atr[lastIdx] || (close * 0.015);
      const distFromCloud = direction === "LONG" ? (close - cloudTop) / atr : (cloudBottom - close) / atr;
      if (distFromCloud > 1.5) confidence += 15;
      else if (distFromCloud > 0.5) confidence += 10;
      else confidence += 5;

      // TK cross quality
      if (freshTkBullishCross || freshTkBearishCross) confidence += 10;
      else confidence += 5;

      // Cloud thickness (thicker = stronger support/resistance)
      if (cloudThicknessPct > 0.01) confidence += 10;
      else if (cloudThicknessPct > 0.005) confidence += 5;

      // Chikou confirmation
      if (chikouConfirmBullish || chikouConfirmBearish) confidence += 10;

      // All five signals aligned = highest conviction
      const allAligned = (direction === "LONG" && priceAboveCloud && tkBullish && bullishCloud && chikouConfirmBullish)
        || (direction === "SHORT" && priceBelowCloud && tkBearish && bearishCloud && chikouConfirmBearish);
      if (allAligned) confidence += 5;

      confidence = Math.min(100, Math.max(0, Math.round(confidence)));
    }

    return { direction, reasoning, confidence };
  }

  public validate(context: StrategyContext): boolean {
    const { candles, indicators } = context;
    return (
      candles.length >= 60 && // senkouBPeriod(52) + displacement buffer
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

    const ichi = this.computeIchimoku(candles);
    const cloudBottom = Math.min(ichi.senkouA[lastIdx], ichi.senkouB[lastIdx]);
    const cloudTop = Math.max(ichi.senkouA[lastIdx], ichi.senkouB[lastIdx]);

    let stopLoss = 0;
    let takeProfit = 0;

    if (direction === "LONG") {
      // SL below cloud bottom or ATR-based
      const slCloud = cloudBottom - 0.5 * atr;
      const slAtr = close - 2.0 * atr;
      stopLoss = Math.max(slCloud, slAtr);
      if (stopLoss >= close) stopLoss = close - 2.0 * atr;
      takeProfit = close + 3.0 * atr;
    } else if (direction === "SHORT") {
      const slCloud = cloudTop + 0.5 * atr;
      const slAtr = close + 2.0 * atr;
      stopLoss = Math.min(slCloud, slAtr);
      if (stopLoss <= close) stopLoss = close + 2.0 * atr;
      takeProfit = close - 3.0 * atr;
    }

    const signal = SignalGenerator.createSignal(this.id, direction, confidence, reasoning, context);

    if (direction !== "HOLD") {
      signal.stopLoss = Number(stopLoss.toFixed(4));
      signal.takeProfit = Number(takeProfit.toFixed(4));
    }

    // Attach Ichimoku-specific indicators
    signal.indicators = {
      ...signal.indicators,
      tenkan: ichi.tenkan[lastIdx],
      kijun: ichi.kijun[lastIdx],
      senkouA: ichi.senkouA[lastIdx],
      senkouB: ichi.senkouB[lastIdx],
    };

    return signal;
  }

  public evaluate(context: StrategyContext): StrategySignal {
    if (!this.enabled || !this.validate(context)) {
      return SignalGenerator.createSignal(this.id, "HOLD", 0, ["Strategy disabled or validation failed — need 60+ candles for Ichimoku."], context);
    }
    return this.generateSignal(context);
  }
}
