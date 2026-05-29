import { TradingStrategy, StrategyContext, StrategySignal } from "../../types";
import { SignalGenerator } from "../../core/signal-generator";
import { RegimeEngine } from "../../core/regime-engine";

export class BollingerBreakoutStrategy implements TradingStrategy {
  public id = "bollinger-breakout";
  public name = "Bollinger Breakout Strategy";
  public description = "Capture volatility expansion breakouts when price closes outside the Bollinger Bands under high volume and rising ADX.";
  public type = "Breakout";
  public timeframe = "15m";
  public timeframes = ["5m", "15m"];
  public symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
  public enabled = true;
  public indicatorsRequired = ["bbUpper", "bbMiddle", "bbLower", "adx", "atr", "volumeMA"];

  public analyze(context: StrategyContext): { direction: "LONG" | "SHORT" | "HOLD"; reasoning: string[]; confidence: number } {
    const { candles, indicators } = context;
    const lastIdx = candles.length - 1;
    const close = candles[lastIdx].close;
    const open = candles[lastIdx].open;
    const high = candles[lastIdx].high;
    const low = candles[lastIdx].low;
    const volume = candles[lastIdx].volume;

    const bbUpper = indicators.bbUpper[lastIdx];
    const bbMiddle = indicators.bbMiddle[lastIdx];
    const bbLower = indicators.bbLower[lastIdx];
    const adxLast = indicators.adx[lastIdx];
    const adxPrev = lastIdx > 0 ? indicators.adx[lastIdx - 1] : 20;
    const volumeMA = indicators.volumeMA[lastIdx] || 1;

    // Calculate Bollinger Band width
    const bbWidth = bbMiddle > 0 ? (bbUpper - bbLower) / bbMiddle : 0;
    const prevBbUpper = lastIdx > 0 ? (indicators.bbUpper[lastIdx - 1] || close) : close;
    const prevBbLower = lastIdx > 0 ? (indicators.bbLower[lastIdx - 1] || close) : close;
    const prevBbMiddle = lastIdx > 0 ? (indicators.bbMiddle[lastIdx - 1] || close) : close;
    const prevBbWidth = prevBbMiddle > 0 ? (prevBbUpper - prevBbLower) / prevBbMiddle : 0;

    const isExpanding = bbWidth > prevBbWidth;
    const isAdxRising = adxLast > adxPrev;
    const hasVolumeExpansion = volume > volumeMA * 1.3;

    // Candle Body Ratio: close to open relative to range
    const candleRange = high - low || 1;
    const bodySize = Math.abs(close - open);
    const bodyRatio = bodySize / candleRange;

    // Wick size check (upper wick for long, lower wick for short)
    const upperWick = high - Math.max(open, close);
    const lowerWick = Math.min(open, close) - low;
    const upperWickRatio = upperWick / candleRange;
    const lowerWickRatio = lowerWick / candleRange;

    let direction: "LONG" | "SHORT" | "HOLD" = "HOLD";
    const reasoning: string[] = [];

    // Filter rules
    const isFakeoutLong = bodyRatio < 0.6 || volume <= volumeMA * 1.1 || adxLast < 20 || upperWickRatio > 0.4;
    const isFakeoutShort = bodyRatio < 0.6 || volume <= volumeMA * 1.1 || adxLast < 20 || lowerWickRatio > 0.4;

    // LONG Conditions:
    // 1. Price closes above upper Bollinger Band
    // 2. ADX rising
    // 3. Bollinger Band width expanding
    // 4. Candle volume above average
    // 5. Strong bullish candle body (closes near high, bodyRatio >= 0.6, close > open)
    const isBbLong = close > bbUpper;
    
    // SHORT Conditions:
    // 1. Price closes below lower Bollinger Band
    // 2. ADX rising
    // 3. Band width expanding
    // 4. Strong bearish candle
    // 5. Volume expansion
    const isBbShort = close < bbLower;

    if (isBbLong && isAdxRising && isExpanding && hasVolumeExpansion && !isFakeoutLong && close > open) {
      direction = "LONG";
      reasoning.push("Bollinger Breakout LONG Triggered.");
      reasoning.push(`Price closed at $${close.toFixed(2)} above upper Bollinger Band ($${bbUpper.toFixed(2)}).`);
      reasoning.push(`ADX is rising (${adxLast.toFixed(1)} > ${adxPrev.toFixed(1)}).`);
      reasoning.push(`Band width is expanding (${(bbWidth * 100).toFixed(2)}% > ${(prevBbWidth * 100).toFixed(2)}%).`);
      reasoning.push(`Volume is ${(volume / volumeMA).toFixed(1)}x the 20-period average.`);
    } else if (isBbShort && isAdxRising && isExpanding && hasVolumeExpansion && !isFakeoutShort && close < open) {
      direction = "SHORT";
      reasoning.push("Bollinger Breakout SHORT Triggered.");
      reasoning.push(`Price closed at $${close.toFixed(2)} below lower Bollinger Band ($${bbLower.toFixed(2)}).`);
      reasoning.push(`ADX is rising (${adxLast.toFixed(1)} > ${adxPrev.toFixed(1)}).`);
      reasoning.push(`Band width is expanding (${(bbWidth * 100).toFixed(2)}% > ${(prevBbWidth * 100).toFixed(2)}%).`);
      reasoning.push(`Volume is ${(volume / volumeMA).toFixed(1)}x the 20-period average.`);
    } else {
      reasoning.push("No Bollinger breakout setup detected.");
    }

    // Confidence scoring:
    let confidence = 0;
    if (direction !== "HOLD") {
      const trendScore = adxLast >= 25 ? 20 : 10;
      const volatilityScore = isExpanding ? 20 : 10;
      const breakoutScore = bodyRatio >= 0.75 ? 20 : 15;
      const volumeScore = volume > volumeMA * 1.5 ? 20 : 15;
      
      const regime = RegimeEngine.getRegimeCategory(context);
      const regimeScore = (regime === "BREAKOUT" || regime === "TRENDING") ? 20 : 10;

      confidence = trendScore + volatilityScore + breakoutScore + volumeScore + regimeScore;
    }

    return { direction, reasoning, confidence };
  }

  public validate(context: StrategyContext): boolean {
    const { candles, indicators } = context;
    return (
      candles.length >= 20 &&
      indicators.bbUpper !== undefined &&
      indicators.bbMiddle !== undefined &&
      indicators.bbLower !== undefined &&
      indicators.adx !== undefined &&
      indicators.atr !== undefined &&
      indicators.volumeMA !== undefined &&
      indicators.bbUpper.length >= candles.length &&
      indicators.bbMiddle.length >= candles.length &&
      indicators.bbLower.length >= candles.length &&
      indicators.adx.length >= candles.length &&
      indicators.atr.length >= candles.length &&
      indicators.volumeMA.length >= candles.length
    );
  }

  public generateSignal(context: StrategyContext): StrategySignal {
    const { direction, reasoning, confidence } = this.analyze(context);
    const { candles, indicators } = context;
    const lastIdx = candles.length - 1;
    const close = candles[lastIdx].close;
    const open = candles[lastIdx].open;
    const high = candles[lastIdx].high;
    const low = candles[lastIdx].low;
    const atr = indicators.atr[lastIdx] || (close * 0.015);

    let stopLoss = 0;
    let takeProfit = 0;

    if (direction === "LONG") {
      stopLoss = low - 0.5 * atr;
      if (stopLoss >= close) {
        stopLoss = close - 1.5 * atr;
      }
      takeProfit = close + 2.0 * (close - stopLoss); // Minimum 1:2 RR
    } else if (direction === "SHORT") {
      stopLoss = high + 0.5 * atr;
      if (stopLoss <= close) {
        stopLoss = close + 1.5 * atr;
      }
      takeProfit = close - 2.0 * (stopLoss - close); // Minimum 1:2 RR
    }

    const bbUpper = indicators.bbUpper[lastIdx] || 0;
    const bbMiddle = indicators.bbMiddle[lastIdx] || 1;
    const bbLower = indicators.bbLower[lastIdx] || 0;
    const bbWidth = (bbUpper - bbLower) / bbMiddle;

    const prevBbUpper = lastIdx > 0 ? (indicators.bbUpper[lastIdx - 1] || bbUpper) : bbUpper;
    const prevBbLower = lastIdx > 0 ? (indicators.bbLower[lastIdx - 1] || bbLower) : bbLower;
    const prevBbMiddle = lastIdx > 0 ? (indicators.bbMiddle[lastIdx - 1] || bbMiddle) : bbMiddle;
    const prevBbWidth = (prevBbUpper - prevBbLower) / (prevBbMiddle || 1);

    const isExpanding = bbWidth > prevBbWidth;
    const volumeMA = indicators.volumeMA[lastIdx] || 1;
    const candleRange = high - low || 1;
    const bodyRatio = Math.abs(close - open) / candleRange;
    const upperWick = high - Math.max(open, close);
    const lowerWick = Math.min(open, close) - low;

    const regime = RegimeEngine.classify(context);
    const regimeCategory = RegimeEngine.getRegimeCategory(context);

    const marketContext = {
      regime,
      regimeCategory,
      volatilityState: {
        currentWidth: bbWidth,
        avgWidth: prevBbWidth,
        isExpanding,
        atr,
      },
      breakoutStrength: {
        bbWidth,
        prevBbWidth,
        bodyRatio,
        volumeRatio: volumeMA > 0 ? candles[lastIdx].volume / volumeMA : 1.0,
        upperWickRatio: upperWick / candleRange,
        lowerWickRatio: lowerWick / candleRange,
      }
    };

    const signal = SignalGenerator.createSignal(
      this.id,
      direction,
      confidence,
      reasoning,
      context,
      marketContext
    );

    // Override SL/TP
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
        ["Strategy disabled or validation failed due to insufficient indicators data."],
        context
      );
    }
    return this.generateSignal(context);
  }
}
