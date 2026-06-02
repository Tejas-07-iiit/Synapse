import { TradingMode,  TradingStrategy, StrategyContext, StrategySignal } from "../../types";
import { SignalGenerator } from "../../core/signal-generator";
import { calculateSMA } from "../../indicators/sma";
import { calculateATR } from "../../indicators/atr";

/**
 * Zeiierman Volatility Strategy
 *
 * Volatility band breakout strategy entering momentum trades when price breaks above or below
 * volatility bands (SMA20 +/- 2*ATR20) confirmed by trend strength (ADX > 25) and
 * high volume participation (Volume > VolumeMA20).
 *
 * LONG:  Close breaks upper volatility band + ADX > 25 + Volume > VolumeMA + Volatility expanding
 * SHORT: Close breaks lower volatility band + ADX > 25 + Volume > VolumeMA + Volatility expanding
 *
 * Stop Loss: Opposite volatility band or 1.5 × ATR
 * Take Profit: Dynamic volatility-based target, minimum 2 × ATR
 */
export class ZeiiermanVolatilityStrategy implements TradingStrategy {
  public id = "zeiierman-volatility";
  public category: TradingMode = TradingMode.INTRADAY;
  public expectedHoldingTime = "1h-8h";
  public name = "Zeiierman Volatility";
  public description = "Volatility breakout strategy entering trades on band breaches confirmed by trend strength and volume expansion.";
  public type = "Volatility";
  public timeframe = "1h";
  public timeframes = ["5m", "15m", "1h", "4h"];
  public symbols: string[] = [];
  public enabled = true;
  public indicatorsRequired = ["atr", "adx", "volumeMA"];
  public supportedRegimes = ["Breakout","High Volatility","Bullish Trend","Bearish Trend"];

  private readonly bandPeriod = 20;
  private readonly adxThreshold = 25;

  // ────────────────────────────────────────────
  // TradingStrategy Interface Implementation
  // ────────────────────────────────────────────

  public analyze(context: StrategyContext): { direction: "LONG" | "SHORT" | "HOLD"; reasoning: string[]; confidence: number } {
    const { candles, indicators } = context;
    const lastIdx = candles.length - 1;
    const close = candles[lastIdx].close;
    const volume = candles[lastIdx].volume;

    const closes = candles.map(c => c.close);
    const sma20 = calculateSMA(closes, this.bandPeriod);
    const atr20 = calculateATR(candles, this.bandPeriod);
    
    const adx = indicators.adx;
    const volumeMA = indicators.volumeMA;

    const sma20Last = sma20[lastIdx];
    const atr20Last = atr20[lastIdx];
    const atr20Prev = atr20[lastIdx - 1];
    
    const adxLast = adx[lastIdx];
    const volumeMALast = volumeMA[lastIdx];

    // Volatility Bands
    const upperBand = sma20Last + 2 * atr20Last;
    const lowerBand = sma20Last - 2 * atr20Last;

    // Volatility expansion rate
    const isVolatilityExpanding = atr20Last > atr20Prev;
    const volatilityRate = atr20Prev > 0 ? (atr20Last - atr20Prev) / atr20Prev : 0;

    // Volume expansion
    const isVolumeHigh = volume > volumeMALast;
    const volumeRatio = volumeMALast > 0 ? volume / volumeMALast : 1;

    let direction: "LONG" | "SHORT" | "HOLD" = "HOLD";
    const reasoning: string[] = [];

    // --- Filters ---
    if (adxLast < 20) {
      reasoning.push(`ADX trend strength (${adxLast.toFixed(1)}) is too weak (< 20) — trendless market.`);
      return { direction: "HOLD", reasoning, confidence: 0 };
    }

    if (!isVolumeHigh) {
      reasoning.push(`Low volume breakout (Volume: ${volume.toFixed(0)} <= MA: ${volumeMALast.toFixed(0)}).`);
      return { direction: "HOLD", reasoning, confidence: 0 };
    }

    if (!isVolatilityExpanding) {
      reasoning.push(`Volatility is contracting (ATR20: ${atr20Last.toFixed(4)} <= prev: ${atr20Prev.toFixed(4)}).`);
      return { direction: "HOLD", reasoning, confidence: 0 };
    }

    // --- LONG ---
    if (close > upperBand && adxLast > this.adxThreshold) {
      direction = "LONG";
      reasoning.push("Zeiierman LONG: Close broke above upper volatility band.");
      reasoning.push(`Upper Volatility Band: $${upperBand.toFixed(2)} (Close: $${close.toFixed(2)}).`);
      reasoning.push(`ADX confirms strong trend (${adxLast.toFixed(1)} > ${this.adxThreshold}).`);
      reasoning.push(`Volume expands above average (Ratio: ${volumeRatio.toFixed(2)}x).`);
      reasoning.push(`Volatility is expanding (rate: ${(volatilityRate * 100).toFixed(2)}%).`);
    }

    // --- SHORT ---
    if (direction === "HOLD" && close < lowerBand && adxLast > this.adxThreshold) {
      direction = "SHORT";
      reasoning.push("Zeiierman SHORT: Close broke below lower volatility band.");
      reasoning.push(`Lower Volatility Band: $${lowerBand.toFixed(2)} (Close: $${close.toFixed(2)}).`);
      reasoning.push(`ADX confirms strong trend (${adxLast.toFixed(1)} > ${this.adxThreshold}).`);
      reasoning.push(`Volume expands above average (Ratio: ${volumeRatio.toFixed(2)}x).`);
      reasoning.push(`Volatility is expanding (rate: ${(volatilityRate * 100).toFixed(2)}%).`);
    }

    if (direction === "HOLD") {
      if (close <= upperBand && close >= lowerBand) {
        reasoning.push(`Price ($${close.toFixed(2)}) is inside volatility bands ($${lowerBand.toFixed(2)} to $${upperBand.toFixed(2)}).`);
      } else {
        reasoning.push(`Price breached band, but ADX trend strength (${adxLast.toFixed(1)}) is insufficient.`);
      }
    }

    // --- Confidence scoring ---
    let confidence = 0;
    if (direction !== "HOLD") {
      confidence = 55; // Base for breakout

      // Band breakout strength
      const breakoutDistance = direction === "LONG" ? (close - upperBand) / close : (lowerBand - close) / close;
      if (breakoutDistance > 0.02) confidence += 15;
      else if (breakoutDistance > 0.01) confidence += 10;
      else confidence += 5;

      // ADX Strength
      if (adxLast > 45) confidence += 15;
      else if (adxLast > 35) confidence += 10;
      else confidence += 5;

      // Volume expansion
      if (volumeRatio > 2.0) confidence += 10;
      else if (volumeRatio > 1.5) confidence += 5;

      // Volatility expansion rate
      if (volatilityRate > 0.05) confidence += 5;

      confidence = Math.min(100, Math.max(0, Math.round(confidence)));
    }

    return { direction, reasoning, confidence };
  }

  public validate(context: StrategyContext): boolean {
    const { candles, indicators } = context;
    return (
      candles.length >= this.bandPeriod + 5 &&
      indicators.atr !== undefined &&
      indicators.atr.length >= candles.length &&
      indicators.adx !== undefined &&
      indicators.adx.length >= candles.length &&
      indicators.volumeMA !== undefined &&
      indicators.volumeMA.length >= candles.length
    );
  }

  public generateSignal(context: StrategyContext): StrategySignal {
    const { direction, reasoning, confidence } = this.analyze(context);
    const { candles, indicators } = context;
    const lastIdx = candles.length - 1;
    const close = candles[lastIdx].close;
    const atr = indicators.atr[lastIdx] || (close * 0.015);

    const closes = candles.map(c => c.close);
    const sma20 = calculateSMA(closes, this.bandPeriod);
    const atr20 = calculateATR(candles, this.bandPeriod);
    const upperBand = sma20[lastIdx] + 2 * atr20[lastIdx];
    const lowerBand = sma20[lastIdx] - 2 * atr20[lastIdx];

    let stopLoss = 0;
    let takeProfit = 0;

    if (direction === "LONG") {
      // Opposite band or 1.5 ATR
      const slBand = lowerBand - 0.2 * atr;
      const slAtr = close - 1.5 * atr;
      stopLoss = Math.max(slBand, slAtr);
      if (stopLoss >= close) stopLoss = close - 1.5 * atr;
      takeProfit = close + 3.0 * atr;
    } else if (direction === "SHORT") {
      // Opposite band or 1.5 ATR
      const slBand = upperBand + 0.2 * atr;
      const slAtr = close + 1.5 * atr;
      stopLoss = Math.min(slBand, slAtr);
      if (stopLoss <= close) stopLoss = close + 1.5 * atr;
      takeProfit = close - 3.0 * atr;
    }

    const signal = SignalGenerator.createSignal(this.id, direction, confidence, reasoning, context);

    if (direction !== "HOLD") {
      signal.stopLoss = Number(stopLoss.toFixed(4));
      signal.takeProfit = Number(takeProfit.toFixed(4));
    }

    // Attach computed indicators
    signal.indicators = {
      ...signal.indicators,
      zeiiermanUpper: upperBand,
      zeiiermanLower: lowerBand,
    };

    return signal;
  }

  public evaluate(context: StrategyContext): StrategySignal {
    if (!this.enabled || !this.validate(context)) {
      return SignalGenerator.createSignal(
        this.id,
        "HOLD",
        0,
        [`Strategy disabled or validation failed — need ${this.bandPeriod + 5}+ candles and required indicators.`],
        context
      );
    }
    return this.generateSignal(context);
  }
}
