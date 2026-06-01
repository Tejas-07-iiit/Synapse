import { TradingStrategy, StrategyContext, StrategySignal } from "../../types";
import { SignalGenerator } from "../../core/signal-generator";
import { RegimeEngine } from "../../core/regime-engine";

export class DonchianBreakoutStrategy implements TradingStrategy {
  public id = "donchian-breakout";
  public name = "Donchian Breakout Strategy";
  public description = "Capture strong momentum breakouts from established Donchian Ranges. Best in breakout/trending markets.";
  public type = "Breakout";
  public timeframe = "15m";
  public timeframes = ["5m", "15m"];
  public symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
  public enabled = true;
  public indicatorsRequired = ["donchianUpper", "donchianLower", "adx", "atr", "volumeMA"];
  public supportedRegimes = ["Breakout","High Volatility","Bullish Trend","Bearish Trend"];

  public analyze(context: StrategyContext): { direction: "LONG" | "SHORT" | "HOLD"; reasoning: string[]; confidence: number } {
    const { candles, indicators } = context;
    const lastIdx = candles.length - 1;
    const close = candles[lastIdx].close;
    const open = candles[lastIdx].open;
    const high = candles[lastIdx].high;
    const low = candles[lastIdx].low;
    const volume = candles[lastIdx].volume;

    const donchianUpper = indicators.donchianUpper || [];
    const donchianLower = indicators.donchianLower || [];
    const adx = indicators.adx || [];
    const volumeMA = indicators.volumeMA || [];
    
    // We compare current close with PREVIOUS Donchian upper/lower (at lastIdx - 1)
    // because current upper/lower are recalculated to include current high/low.
    const prevUpper = lastIdx > 0 ? donchianUpper[lastIdx - 1] : high;
    const prevLower = lastIdx > 0 ? donchianLower[lastIdx - 1] : low;
    const currentAdx = adx[lastIdx] || 15;
    const prevAdx = lastIdx > 0 ? adx[lastIdx - 1] : 15;
    const currentVolumeMA = volumeMA[lastIdx] || 1;

    const isAdxRising = currentAdx > prevAdx;
    const isAdxStrong = currentAdx > 20;
    const hasVolumeExpansion = volume > currentVolumeMA * 1.3;

    // Candle metrics
    const range = high - low || 1;
    const body = Math.abs(close - open);
    const bodyRatio = body / range;
    const upperWick = high - Math.max(open, close);
    const lowerWick = Math.min(open, close) - low;
    const upperWickRatio = upperWick / range;
    const lowerWickRatio = lowerWick / range;

    const isStrongBullishCandle = bodyRatio >= 0.6 && close > open && upperWickRatio < 0.4;
    const isStrongBearishCandle = bodyRatio >= 0.6 && close < open && lowerWickRatio < 0.4;

    const regime = RegimeEngine.getRegimeCategory(context);
    const isTrendingOrBreakout = regime === "TRENDING" || regime === "BREAKOUT";

    let direction: "LONG" | "SHORT" | "HOLD" = "HOLD";
    const reasoning: string[] = [];

    // Filter check
    if (!isAdxStrong) {
      reasoning.push(`Donchian ignored: Low ADX environment (${currentAdx.toFixed(1)} < 20).`);
      return { direction: "HOLD", reasoning, confidence: 0 };
    }

    const prevClose = lastIdx > 0 ? candles[lastIdx - 1].close : close;
    const closedAboveChannel = prevClose <= prevUpper && close > prevUpper;
    const closedBelowChannel = prevClose >= prevLower && close < prevLower;

    if (closedAboveChannel && isAdxRising && hasVolumeExpansion && isStrongBullishCandle && isTrendingOrBreakout) {
      direction = "LONG";
      reasoning.push("Donchian Channel LONG Breakout Confirmed.");
      reasoning.push(`Price closed at $${close.toFixed(2)} above Upper Channel ($${prevUpper.toFixed(2)}).`);
      reasoning.push(`ADX is rising (${currentAdx.toFixed(1)} > ${prevAdx.toFixed(1)}), indicating breakout momentum.`);
      reasoning.push(`Volume is ${(volume / currentVolumeMA).toFixed(1)}x average.`);
    } else if (closedBelowChannel && isAdxRising && hasVolumeExpansion && isStrongBearishCandle && isTrendingOrBreakout) {
      direction = "SHORT";
      reasoning.push("Donchian Channel SHORT Breakout Confirmed.");
      reasoning.push(`Price closed at $${close.toFixed(2)} below Lower Channel ($${prevLower.toFixed(2)}).`);
      reasoning.push(`ADX is rising (${currentAdx.toFixed(1)} > ${prevAdx.toFixed(1)}), confirming trend continuation.`);
      reasoning.push(`Volume is ${(volume / currentVolumeMA).toFixed(1)}x average.`);
    } else {
      reasoning.push("No Donchian breakout setup matching criteria.");
    }

    // Confidence score calculation
    let confidence = 0;
    if (direction !== "HOLD") {
      const adxScore = currentAdx >= 30 ? 25 : 15;
      const volumeScore = volume > currentVolumeMA * 1.8 ? 25 : 15;
      const bodyScore = bodyRatio >= 0.85 ? 25 : 15;
      const regimeScore = regime === "BREAKOUT" ? 25 : 15;
      
      confidence = adxScore + volumeScore + bodyScore + regimeScore;
    }

    return { direction, reasoning, confidence };
  }

  public validate(context: StrategyContext): boolean {
    const { candles, indicators } = context;
    return (
      candles.length >= 20 &&
      indicators.donchianUpper !== undefined &&
      indicators.donchianLower !== undefined &&
      indicators.adx !== undefined &&
      indicators.atr !== undefined &&
      indicators.volumeMA !== undefined &&
      indicators.donchianUpper.length >= candles.length &&
      indicators.donchianLower.length >= candles.length &&
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
    const high = candles[lastIdx].high;
    const low = candles[lastIdx].low;
    const atr = indicators.atr[lastIdx] || (close * 0.015);

    let stopLoss = 0;
    let takeProfit = 0;

    if (direction === "LONG") {
      stopLoss = low - 0.2 * atr;
      if (stopLoss >= close) {
        stopLoss = close - 1.5 * atr;
      }
      takeProfit = close + 2.0 * (close - stopLoss); // 1:2 Risk-Reward ratio minimum
    } else if (direction === "SHORT") {
      stopLoss = high + 0.2 * atr;
      if (stopLoss <= close) {
        stopLoss = close + 1.5 * atr;
      }
      takeProfit = close - 2.0 * (stopLoss - close); // 1:2 Risk-Reward ratio minimum
    }

    const bbUpper = indicators.bbUpper?.[lastIdx] || 0;
    const bbMiddle = indicators.bbMiddle?.[lastIdx] || 1;
    const bbLower = indicators.bbLower?.[lastIdx] || 0;
    const bbWidth = (bbUpper - bbLower) / bbMiddle;

    const prevBbUpper = lastIdx > 0 ? (indicators.bbUpper?.[lastIdx - 1] || bbUpper) : bbUpper;
    const prevBbLower = lastIdx > 0 ? (indicators.bbLower?.[lastIdx - 1] || bbLower) : bbLower;
    const prevBbMiddle = lastIdx > 0 ? (indicators.bbMiddle?.[lastIdx - 1] || bbMiddle) : bbMiddle;
    const prevBbWidth = (prevBbUpper - prevBbLower) / (prevBbMiddle || 1);

    const regime = RegimeEngine.classify(context);
    const regimeCategory = RegimeEngine.getRegimeCategory(context);

    const marketContext = {
      regime,
      regimeCategory,
      volatilityState: {
        currentWidth: bbWidth,
        avgWidth: prevBbWidth,
        isExpanding: bbWidth > prevBbWidth,
        atr,
      },
      breakoutStrength: {
        bbWidth,
        prevBbWidth,
        bodyRatio: Math.abs(close - candles[lastIdx].open) / (high - low || 1),
        volumeRatio: indicators.volumeMA?.[lastIdx] ? candles[lastIdx].volume / indicators.volumeMA[lastIdx] : 1,
        upperWickRatio: (high - Math.max(candles[lastIdx].open, close)) / (high - low || 1),
        lowerWickRatio: (Math.min(candles[lastIdx].open, close) - low) / (high - low || 1),
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
