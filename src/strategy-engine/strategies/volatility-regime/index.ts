import { TradingMode,  TradingStrategy, StrategyContext, StrategySignal } from "../../types";
import { SignalGenerator } from "../../core/signal-generator";
import { getATRPct } from "../../utils/volatility";

/**
 * Volatility Regime Strategy
 *
 * Classifies market volatility based on percentile rankings of ATR percentage over a rolling
 * 100-period lookback. Restricts execution during Low Volatility chop and Extreme spikes,
 * targeting expansions during Normal and High volatility trends.
 *
 * Regimes:
 *   - LOW Volatility: Percentile < 25% (chop filter)
 *   - NORMAL Volatility: Percentile 25% - 75%
 *   - HIGH Volatility: Percentile 75% - 90%
 *   - EXTREME Volatility: Percentile >= 90% (overshot spike filter)
 *
 * LONG:  ATRPct increasing + ADX > 25 + Trend Bullish (Price > EMA20 > SMA50)
 * SHORT: ATRPct increasing + ADX > 25 + Trend Bearish (Price < EMA20 < SMA50)
 */
export class VolatilityRegimeStrategy implements TradingStrategy {
  public id = "volatility-regime";
  public category: TradingMode = TradingMode.INTRADAY;
  public expectedHoldingTime = "1h-8h";
  public name = "Volatility Regime";
  public description = "Adaptive strategy classifying volatility regimes using rolling ATR rankings, entering trends only under favorable volatility environments.";
  public type = "Volatility";
  public timeframe = "1h";
  public timeframes = ["5m", "15m", "1h", "4h"];
  public symbols: string[] = [];
  public enabled = true;
  public indicatorsRequired = ["atr", "adx", "ema20", "sma50"];
  public supportedRegimes = ["Breakout","High Volatility","Bullish Trend","Bearish Trend"];

  private readonly lookback = 100;
  private readonly adxThreshold = 25;

  // ────────────────────────────────────────────
  // TradingStrategy Interface Implementation
  // ────────────────────────────────────────────

  public analyze(context: StrategyContext): { direction: "LONG" | "SHORT" | "HOLD"; reasoning: string[]; confidence: number } {
    const { candles, indicators } = context;
    const lastIdx = candles.length - 1;
    const close = candles[lastIdx].close;

    const atrPct = getATRPct(candles, 14);
    const adx = indicators.adx;
    const ema20 = indicators.ema20;
    const sma50 = indicators.sma50;

    const currentAtrPct = atrPct[lastIdx];
    const adxLast = adx[lastIdx];
    const ema20Last = ema20[lastIdx];
    const sma50Last = sma50[lastIdx];

    // Compute Volatility Percentile Rank over rolling lookback
    const startIdx = Math.max(0, lastIdx - this.lookback);
    const history = atrPct.slice(startIdx, lastIdx + 1);
    const sorted = [...history].sort((a, b) => a - b);
    const rank = sorted.indexOf(currentAtrPct) / sorted.length;

    let regime: "LOW" | "NORMAL" | "HIGH" | "EXTREME" = "NORMAL";
    if (rank < 0.25) regime = "LOW";
    else if (rank < 0.75) regime = "NORMAL";
    else if (rank < 0.90) regime = "HIGH";
    else regime = "EXTREME";

    // Check if ATRPct is expanding (slope of ATRPct over last 3 candles is positive)
    const atrPctPrev = atrPct[lastIdx - 1];
    const atrPctPrev2 = atrPct[lastIdx - 2];
    const atrPctExpanding = currentAtrPct > atrPctPrev && atrPctPrev > atrPctPrev2;

    // Trend Direction
    const bullishTrend = close > ema20Last && ema20Last > sma50Last;
    const bearishTrend = close < ema20Last && ema20Last < sma50Last;

    let direction: "LONG" | "SHORT" | "HOLD" = "HOLD";
    const reasoning: string[] = [];

    // --- Filters ---
    if (adxLast < 20) {
      reasoning.push(`Trend strength too low (ADX: ${adxLast.toFixed(1)} < 20) — trendless market.`);
      return { direction: "HOLD", reasoning, confidence: 0 };
    }

    if (regime === "LOW") {
      reasoning.push(`Low Volatility chop detected (ATRPct Rank: ${(rank * 100).toFixed(1)}%). Avoiding execution.`);
      return { direction: "HOLD", reasoning, confidence: 0 };
    }

    if (regime === "EXTREME") {
      reasoning.push(`Extreme Volatility spike detected (ATRPct Rank: ${(rank * 100).toFixed(1)}%). Avoiding high-risk entry.`);
      return { direction: "HOLD", reasoning, confidence: 0 };
    }

    // --- LONG ---
    if (atrPctExpanding && adxLast > this.adxThreshold && bullishTrend) {
      direction = "LONG";
      reasoning.push(`Volatility Regime LONG: Favorable ${regime} Volatility regime (ATRPct Rank: ${(rank * 100).toFixed(1)}%).`);
      reasoning.push(`Volatility is expanding (ATRPct: ${currentAtrPct.toFixed(3)}% > ${atrPctPrev.toFixed(3)}%).`);
      reasoning.push(`ADX confirms strong trend (${adxLast.toFixed(1)} > ${this.adxThreshold}).`);
      reasoning.push(`Bullish trend alignment verified (Close > EMA20 > SMA50).`);
    }

    // --- SHORT ---
    if (direction === "HOLD" && atrPctExpanding && adxLast > this.adxThreshold && bearishTrend) {
      direction = "SHORT";
      reasoning.push(`Volatility Regime SHORT: Favorable ${regime} Volatility regime (ATRPct Rank: ${(rank * 100).toFixed(1)}%).`);
      reasoning.push(`Volatility is expanding (ATRPct: ${currentAtrPct.toFixed(3)}% > ${atrPctPrev.toFixed(3)}%).`);
      reasoning.push(`ADX confirms strong trend (${adxLast.toFixed(1)} > ${this.adxThreshold}).`);
      reasoning.push(`Bearish trend alignment verified (Close < EMA20 < SMA50).`);
    }

    if (direction === "HOLD") {
      if (!atrPctExpanding) {
        reasoning.push(`Volatility is not actively expanding (ATRPct: ${currentAtrPct.toFixed(3)}% vs prev: ${atrPctPrev.toFixed(3)}%).`);
      } else if (adxLast <= this.adxThreshold) {
        reasoning.push(`ADX trend strength (${adxLast.toFixed(1)}) below confidence trigger (${this.adxThreshold}).`);
      } else {
        reasoning.push("No clear bullish or bearish trend structure exists.");
      }
    }

    // --- Confidence scoring ---
    let confidence = 0;
    if (direction !== "HOLD") {
      confidence = 55; // Base

      // Volatility expansion rate
      const expansionRate = atrPctPrev > 0 ? (currentAtrPct - atrPctPrev) / atrPctPrev : 0;
      if (expansionRate > 0.10) confidence += 15;
      else if (expansionRate > 0.05) confidence += 10;
      else confidence += 5;

      // ADX Strength
      if (adxLast > 45) confidence += 15;
      else if (adxLast > 35) confidence += 10;
      else confidence += 5;

      // Regime Quality (Normal volatility is preferred for standard trades over High)
      if (regime === "NORMAL") confidence += 10;
      else if (regime === "HIGH") confidence += 5;

      // Trend persistence (Distance between Close and EMA20)
      const trendDistance = Math.abs(close - ema20Last) / close;
      if (trendDistance > 0.01) confidence += 5;

      confidence = Math.min(100, Math.max(0, Math.round(confidence)));
    }

    return { direction, reasoning, confidence };
  }

  public validate(context: StrategyContext): boolean {
    const { candles, indicators } = context;
    return (
      candles.length >= this.lookback + 10 &&
      indicators.atr !== undefined &&
      indicators.atr.length >= candles.length &&
      indicators.adx !== undefined &&
      indicators.adx.length >= candles.length &&
      indicators.ema20 !== undefined &&
      indicators.ema20.length >= candles.length &&
      indicators.sma50 !== undefined &&
      indicators.sma50.length >= candles.length
    );
  }

  public generateSignal(context: StrategyContext): StrategySignal {
    const { direction, reasoning, confidence } = this.analyze(context);
    const { candles, indicators } = context;
    const lastIdx = candles.length - 1;
    const close = candles[lastIdx].close;
    const atr = indicators.atr[lastIdx] || (close * 0.015);

    // Calculate rank again for takeProfit calculation
    const atrPct = getATRPct(candles, 14);
    const currentAtrPct = atrPct[lastIdx];
    const startIdx = Math.max(0, lastIdx - this.lookback);
    const history = atrPct.slice(startIdx, lastIdx + 1);
    const sorted = [...history].sort((a, b) => a - b);
    const rank = sorted.indexOf(currentAtrPct) / sorted.length;
    
    let tpMultiplier = 3.0; // Normal Volatility
    if (rank >= 0.75) {
      tpMultiplier = 2.0;   // High Volatility
    }

    let stopLoss = 0;
    let takeProfit = 0;

    if (direction === "LONG") {
      stopLoss = close - 1.5 * atr;
      takeProfit = close + tpMultiplier * atr;
    } else if (direction === "SHORT") {
      stopLoss = close + 1.5 * atr;
      takeProfit = close - tpMultiplier * atr;
    }

    const signal = SignalGenerator.createSignal(this.id, direction, confidence, reasoning, context);

    if (direction !== "HOLD") {
      signal.stopLoss = Number(stopLoss.toFixed(4));
      signal.takeProfit = Number(takeProfit.toFixed(4));
    }

    // Attach volatility metrics
    signal.indicators = {
      ...signal.indicators,
      atrPct: currentAtrPct,
      volatilityPercentile: rank * 100,
    };

    return signal;
  }

  public evaluate(context: StrategyContext): StrategySignal {
    if (!this.enabled || !this.validate(context)) {
      return SignalGenerator.createSignal(
        this.id,
        "HOLD",
        0,
        [`Strategy disabled or validation failed — need ${this.lookback + 10}+ candles and required indicators.`],
        context
      );
    }
    return this.generateSignal(context);
  }
}
