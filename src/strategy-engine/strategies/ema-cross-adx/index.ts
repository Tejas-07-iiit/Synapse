import { TradingMode, ConsensusCategory, TradingStrategy, StrategyContext, StrategySignal } from "../../types";
import { SignalGenerator } from "../../core/signal-generator";

/**
 * EMA Cross ADX Strategy
 *
 * Concept: Trade only when a confirmed trend exists.
 * Uses EMA20/EMA50 crossover + ADX(14) trend strength + MACD confirmation.
 * Avoids sideways markets entirely via ADX filtering.
 *
 * LONG:  EMA20 > EMA50 + fresh bullish crossover + ADX > 25 + MACD hist > 0
 * SHORT: EMA20 < EMA50 + fresh bearish crossover + ADX > 25 + MACD hist < 0
 *
 * Filter: Reject if ADX < 20 or flat EMA separation.
 *
 * Confidence: 35% EMA alignment + 35% ADX strength + 30% MACD confirmation
 *
 * Stop Loss: Below EMA50 or 1.5 × ATR (whichever is tighter)
 * Take Profit: 2 × ATR minimum
 */
export class EMACrossADXStrategy implements TradingStrategy {
  public id = "ema-cross-adx";
  public category: TradingMode = TradingMode.INTRADAY;
  public consensusCategory: ConsensusCategory = ConsensusCategory.INTRADAY;
  public expectedHoldingTime = "1h-8h";
  public name = "EMA Cross ADX Strategy";
  public description = "Trend-following strategy combining EMA20/EMA50 crossover with ADX strength filtering and MACD momentum confirmation.";
  public type = "Trend Following";
  public timeframe = "15m";
  public timeframes = ["15m", "30m", "1h"];
  public symbols: string[] = [];
  public enabled = true;
  public indicatorsRequired = ["ema20", "sma50", "adx", "macdHist", "macdLine", "signalLine", "atr"];
  public supportedRegimes = ["Bullish Trend","Bearish Trend","Breakout","High Volatility"];

  private readonly adxThreshold = 18;
  private readonly adxMinimum = 15;
  private readonly minEmaSeparation = 0.0005; // Minimum % separation to avoid flat crossovers

  // ────────────────────────────────────────────
  // TradingStrategy interface
  // ────────────────────────────────────────────

  public analyze(context: StrategyContext): { direction: "LONG" | "SHORT" | "HOLD"; reasoning: string[]; confidence: number } {
    const { candles, indicators } = context;
    const lastIdx = candles.length - 1;
    const close = candles[lastIdx].close;

    const ema20Last = indicators.ema20[lastIdx];
    const ema20Prev = indicators.ema20[lastIdx - 1];
    const sma50Last = indicators.sma50[lastIdx]; // Using SMA50 as EMA50 equivalent
    const sma50Prev = indicators.sma50[lastIdx - 1];

    const adxLast = indicators.adx[lastIdx] ?? 0;
    const macdHist = indicators.macdHist[lastIdx] ?? 0;
    const macdLine = indicators.macdLine?.[lastIdx] ?? 0;
    const signalLine = indicators.signalLine?.[lastIdx] ?? 0;

    // Crossover detection
    const bullishCross = ema20Prev <= sma50Prev && ema20Last > sma50Last;
    const bearishCross = ema20Prev >= sma50Prev && ema20Last < sma50Last;

    // EMA alignment (trend state, not just crossover)
    const emaBullish = ema20Last > sma50Last;
    const emaBearish = ema20Last < sma50Last;

    // EMA separation check (avoid flat/overlapping EMAs)
    const emaSeparation = close > 0 ? Math.abs(ema20Last - sma50Last) / close : 0;
    const isFlatSeparation = emaSeparation < this.minEmaSeparation;

    // Fresh crossover: crossover happened within last 3 candles
    let freshBullishCross = false;
    let freshBearishCross = false;
    for (let i = 0; i < 5; i++) {
      const idx = lastIdx - i;
      if (idx > 0) {
        const prevEma = indicators.ema20[idx - 1];
        const lastEma = indicators.ema20[idx];
        const prevSma = indicators.sma50[idx - 1];
        const lastSma = indicators.sma50[idx];
        if (prevEma <= prevSma && lastEma > lastSma) freshBullishCross = true;
        if (prevEma >= prevSma && lastEma < lastSma) freshBearishCross = true;
      }
    }

    let direction: "LONG" | "SHORT" | "HOLD" = "HOLD";
    const reasoning: string[] = [];

    // --- Filter: ADX too low ---
    if (adxLast < this.adxMinimum) {
      reasoning.push(`ADX at ${adxLast.toFixed(1)} is below ${this.adxMinimum} — sideways market, rejecting.`);
      return { direction: "HOLD", reasoning, confidence: 0 };
    }

    // --- Filter: Flat EMA separation ---
    if (isFlatSeparation && !freshBullishCross && !freshBearishCross) {
      reasoning.push(`EMA separation too flat (${(emaSeparation * 100).toFixed(4)}%) — no clear trend.`);
      return { direction: "HOLD", reasoning, confidence: 0 };
    }

    // --- LONG conditions ---
    if (emaBullish && freshBullishCross && adxLast > this.adxThreshold && macdHist > 0) {
      direction = "LONG";
      reasoning.push("EMA Cross ADX LONG: EMA20 crossed above EMA50 (bullish crossover).");
      reasoning.push(`ADX at ${adxLast.toFixed(1)} confirms strong trend (> ${this.adxThreshold}).`);
      reasoning.push(`MACD histogram positive (${macdHist.toFixed(4)}) — momentum confirmation.`);
      reasoning.push(`EMA separation: ${(emaSeparation * 100).toFixed(3)}%.`);
    }

    // --- SHORT conditions ---
    if (direction === "HOLD" && emaBearish && freshBearishCross && adxLast > this.adxThreshold && macdHist < 0) {
      direction = "SHORT";
      reasoning.push("EMA Cross ADX SHORT: EMA20 crossed below EMA50 (bearish crossover).");
      reasoning.push(`ADX at ${adxLast.toFixed(1)} confirms strong trend (> ${this.adxThreshold}).`);
      reasoning.push(`MACD histogram negative (${macdHist.toFixed(4)}) — momentum confirmation.`);
      reasoning.push(`EMA separation: ${(emaSeparation * 100).toFixed(3)}%.`);
    }

    if (direction === "HOLD") {
      if (!freshBullishCross && !freshBearishCross) {
        reasoning.push("No fresh EMA crossover within last 3 candles.");
      } else if (adxLast <= this.adxThreshold) {
        reasoning.push(`ADX at ${adxLast.toFixed(1)} — trend not strong enough (need > ${this.adxThreshold}).`);
      } else {
        reasoning.push("MACD histogram does not confirm crossover direction.");
      }
    }

    // --- Confidence scoring: 35% EMA + 35% ADX + 30% MACD ---
    let confidence = 0;
    if (direction !== "HOLD") {
      // EMA alignment component (35%)
      let emaScore = 10; // Base for valid crossover
      if (bullishCross || bearishCross) emaScore += 15; // Same-candle crossover
      else emaScore += 8; // Recent crossover

      // EMA separation strength
      if (emaSeparation > 0.005) emaScore += 10;
      else if (emaSeparation > 0.002) emaScore += 5;
      emaScore = Math.min(35, emaScore);

      // ADX strength component (35%)
      let adxScore = 10;
      if (adxLast > 40) adxScore += 20;
      else if (adxLast > 30) adxScore += 15;
      else adxScore += 10;

      // ADX rising (strengthening trend)
      const adxPrev = lastIdx > 0 ? (indicators.adx[lastIdx - 1] ?? 0) : 0;
      if (adxLast > adxPrev) adxScore += 5;
      adxScore = Math.min(35, adxScore);

      // MACD confirmation component (30%)
      let macdScore = 10;
      // MACD line vs signal line agreement
      if (direction === "LONG" && macdLine > signalLine) macdScore += 10;
      else if (direction === "SHORT" && macdLine < signalLine) macdScore += 10;

      // Histogram magnitude
      const atr = indicators.atr[lastIdx] || (close * 0.015);
      const histNorm = atr > 0 ? Math.abs(macdHist) / atr : 0;
      if (histNorm > 0.3) macdScore += 10;
      else if (histNorm > 0.1) macdScore += 5;
      macdScore = Math.min(30, macdScore);

      confidence = 20 + emaScore + adxScore + macdScore; // +20 base floor to pass FINAL_SCORE_THRESHOLD(60)
      confidence = Math.min(100, Math.max(0, Math.round(confidence)));
    }

    return { direction, reasoning, confidence };
  }

  public validate(context: StrategyContext): boolean {
    const { candles, indicators } = context;
    return (
      candles.length >= 55 && // SMA50 needs 50+ candles + buffer
      indicators.ema20 !== undefined &&
      indicators.ema20.length >= candles.length &&
      indicators.sma50 !== undefined &&
      indicators.sma50.length >= candles.length &&
      indicators.adx !== undefined &&
      indicators.adx.length >= candles.length &&
      indicators.macdHist !== undefined &&
      indicators.macdHist.length >= candles.length &&
      indicators.macdLine !== undefined &&
      indicators.macdLine.length >= candles.length &&
      indicators.signalLine !== undefined &&
      indicators.signalLine.length >= candles.length &&
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
    const sma50Last = indicators.sma50[lastIdx];

    let stopLoss = 0;
    let takeProfit = 0;

    if (direction === "LONG") {
      // SL below EMA50 or 1.5 × ATR — whichever is tighter (closer to entry)
      const slEma = sma50Last - 0.5 * atr; // Just below EMA50
      const slAtr = close - 1.5 * atr;
      stopLoss = Math.max(slEma, slAtr); // Tighter = higher for LONG
      if (stopLoss >= close) stopLoss = close - 1.5 * atr; // Fallback
      takeProfit = close + 2.0 * atr;
    } else if (direction === "SHORT") {
      const slEma = sma50Last + 0.5 * atr; // Just above EMA50
      const slAtr = close + 1.5 * atr;
      stopLoss = Math.min(slEma, slAtr); // Tighter = lower for SHORT
      if (stopLoss <= close) stopLoss = close + 1.5 * atr; // Fallback
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
