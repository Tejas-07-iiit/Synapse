import { TradingMode,  TradingStrategy, StrategyContext, StrategySignal } from "../../types";
import { SignalGenerator } from "../../core/signal-generator";
import { RegimeEngine } from "../../core/regime-engine";

function calculateSMA(data: number[], period: number): number[] {
  const result: number[] = new Array(data.length).fill(0);
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i];
    if (i >= period) {
      sum -= data[i - period];
    }
    if (i >= period - 1) {
      result[i] = sum / period;
    }
  }
  return result;
}

function calculateEMA(data: number[], period: number): number[] {
  const result: number[] = new Array(data.length).fill(0);
  if (data.length === 0) return result;
  const k = 2 / (period + 1);
  result[0] = data[0];
  for (let i = 1; i < data.length; i++) {
    result[i] = data[i] * k + result[i - 1] * (1 - k);
  }
  return result;
}

function calculateCCI(highs: number[], lows: number[], closes: number[], period: number = 20): number[] {
  const tps = closes.map((c, i) => (highs[i] + lows[i] + c) / 3);
  const smaTps = calculateSMA(tps, period);
  const cci = new Array(closes.length).fill(0);
  for (let i = period - 1; i < closes.length; i++) {
    let meanDev = 0;
    for (let j = 0; j < period; j++) {
      meanDev += Math.abs(tps[i - j] - smaTps[i]);
    }
    meanDev /= period;
    if (meanDev === 0) {
      cci[i] = 0;
    } else {
      cci[i] = (tps[i] - smaTps[i]) / (0.015 * meanDev);
    }
  }
  return cci;
}

function calculateWaveTrend(highs: number[], lows: number[], closes: number[], n1: number = 10, n2: number = 21): number[] {
  const ap = closes.map((c, i) => (highs[i] + lows[i] + c) / 3);
  const esa = calculateEMA(ap, n1);
  const d = calculateEMA(ap.map((val, i) => Math.abs(val - esa[i])), n1);
  const ci = ap.map((val, i) => d[i] === 0 ? 0 : (val - esa[i]) / (0.015 * d[i]));
  const tci = calculateEMA(ci, n2);
  return tci;
}

export class LorentzianStrategy implements TradingStrategy {
  public id = "lorentzian";
  public category: TradingMode = TradingMode.INTRADAY;
  public expectedHoldingTime = "1h-8h";
  public name = "Lorentzian Classification";
  public description = "Statistical similarity classification strategy that matches current market state with historical nearest neighbors to predict trend direction.";
  public type = "Lorentzian";
  public timeframe = "15m";
  public timeframes = ["15m", "30m", "1h"];
  public symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
  public enabled = true;
  public indicatorsRequired = ["rsi", "adx", "atr"];
  public supportedRegimes = ["Bullish Trend","Bearish Trend","Breakout","High Volatility"];

  public analyze(context: StrategyContext): { direction: "LONG" | "SHORT" | "HOLD"; reasoning: string[]; confidence: number; probability?: number } {
    const { candles, indicators } = context;
    const lastIdx = candles.length - 1;
    const close = candles[lastIdx].close;
    const adxLast = indicators.adx[lastIdx];

    let direction: "LONG" | "SHORT" | "HOLD" = "HOLD";
    const reasoning: string[] = [];

    // 1. Calculate indicators needed for features
    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);
    const closes = candles.map((c) => c.close);

    const cci = calculateCCI(highs, lows, closes, 20);
    const wt = calculateWaveTrend(highs, lows, closes, 10, 21);
    const ema200 = calculateEMA(closes, 200);

    const rsi = indicators.rsi;
    const adx = indicators.adx;

    // Helper to extract feature vector
    const getFeatureVector = (idx: number) => {
      const ema200Dist = (closes[idx] - ema200[idx]) / closes[idx];
      return [
        rsi[idx] || 50,
        adx[idx] || 20,
        cci[idx] || 0,
        wt[idx] || 0,
        ema200Dist * 100, // scaled percentage distance
      ];
    };

    // 2. Build current feature vector
    const currentVector = getFeatureVector(lastIdx);

    // 3. Build historical dataset and compare distances
    // We start at index 200 to ensure EMA200 is fully formed and stable
    const k = 8;
    const neighbors: { distance: number; direction: number }[] = [];

    for (let i = 200; i < lastIdx - 5; i++) {
      const histVector = getFeatureVector(i);
      
      // Calculate Lorentzian distance: Sum(ln(1 + |x_i - y_i|))
      let distance = 0;
      for (let f = 0; f < 5; f++) {
        distance += Math.log(1 + Math.abs(currentVector[f] - histVector[f]));
      }

      // Determine future direction (forward 4 bars)
      const futureReturn = closes[i + 4] - closes[i];
      const histDirection = futureReturn > 0 ? 1 : (futureReturn < 0 ? -1 : 0);

      neighbors.push({ distance, direction: histDirection });
    }

    // Sort neighbors by distance ascending
    neighbors.sort((a, b) => a.distance - b.distance);

    // Get the k nearest neighbors
    const nearest = neighbors.slice(0, k);

    // Count directional bias
    const bullishCount = nearest.filter((n) => n.direction === 1).length;
    const bearishCount = nearest.filter((n) => n.direction === -1).length;

    const probBullish = (bullishCount / k) * 100;
    const probBearish = (bearishCount / k) * 100;

    // 4. Signal Conditions
    // LONG: bullish similarity >= 62.5% (5/8), close > ema200, adx > 20
    // SHORT: bearish similarity >= 62.5% (5/8), close < ema200, adx > 20
    const isEmaBullish = close > ema200[lastIdx];
    const isEmaBearish = close < ema200[lastIdx];
    const trendStrong = adxLast > 20;

    if (probBullish >= 62.5 && isEmaBullish && trendStrong) {
      direction = "LONG";
      reasoning.push("Lorentzian Statistical Classification LONG Triggered.");
      reasoning.push(` बुलिश (Bullish) Historical similarity is ${(probBullish).toFixed(1)}% among ${k} nearest neighbors.`);
      reasoning.push(`Price is in bullish alignment above EMA200 ($${ema200[lastIdx].toFixed(2)}).`);
      reasoning.push(`ADX confirms strong trend environment: ${adxLast.toFixed(1)}.`);
    } else if (probBearish >= 62.5 && isEmaBearish && trendStrong) {
      direction = "SHORT";
      reasoning.push("Lorentzian Statistical Classification SHORT Triggered.");
      reasoning.push(` बेयरिश (Bearish) Historical similarity is ${(probBearish).toFixed(1)}% among ${k} nearest neighbors.`);
      reasoning.push(`Price is in bearish alignment below EMA200 ($${ema200[lastIdx].toFixed(2)}).`);
      reasoning.push(`ADX confirms strong trend environment: ${adxLast.toFixed(1)}.`);
    } else {
      reasoning.push(`No statistical consensus. Neighbors: ${bullishCount} Bullish, ${bearishCount} Bearish.`);
    }

    // Confidence scoring
    let confidence = 0;
    if (direction !== "HOLD") {
      const similarityScore = direction === "LONG" ? Math.round(probBullish) : Math.round(probBearish); // Up to 100
      const trendScore = trendStrong ? 20 : 10;
      const regime = RegimeEngine.getRegimeCategory(context);
      const regimeScore = regime === "TRENDING" ? 20 : 10;
      
      // Combine to normalized confidence
      confidence = Math.min(100, Math.max(0, Math.round((similarityScore * 0.6) + trendScore + regimeScore)));
    }

    return { direction, reasoning, confidence, probability: direction === "LONG" ? probBullish : (direction === "SHORT" ? probBearish : 0) };
  }

  public validate(context: StrategyContext): boolean {
    const { candles, indicators } = context;
    return (
      candles.length >= 250 && // Need at least 250 candles to compute EMA200 and have a database
      indicators.rsi !== undefined &&
      indicators.rsi.length >= candles.length &&
      indicators.adx !== undefined &&
      indicators.adx.length >= candles.length &&
      indicators.atr !== undefined &&
      indicators.atr.length >= candles.length
    );
  }

  public generateSignal(context: StrategyContext): StrategySignal {
    const { direction, reasoning, confidence, probability } = this.analyze(context) as {
      direction: "LONG" | "SHORT" | "HOLD";
      reasoning: string[];
      confidence: number;
      probability: number;
    };
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
      stopLoss = close - 2.0 * atr;
      takeProfit = close + 4.0 * atr; // 1:2 RR
    } else if (direction === "SHORT") {
      stopLoss = close + 2.0 * atr;
      takeProfit = close - 4.0 * atr; // 1:2 RR
    }

    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);
    const closes = candles.map((c) => c.close);

    const cci = calculateCCI(highs, lows, closes, 20);
    const wt = calculateWaveTrend(highs, lows, closes, 10, 21);
    const ema200 = calculateEMA(closes, 200);

    const rsi = indicators.rsi;
    const adx = indicators.adx;

    const ema200Dist = (closes[lastIdx] - ema200[lastIdx]) / closes[lastIdx];
    const featureVector = [
      rsi[lastIdx] || 50,
      adx[lastIdx] || 20,
      cci[lastIdx] || 0,
      wt[lastIdx] || 0,
      ema200Dist * 100,
    ];

    const regime = RegimeEngine.classify(context);
    const regimeCategory = RegimeEngine.getRegimeCategory(context);
    const bbUpper = indicators?.bbUpper?.[lastIdx] || 0;
    const bbLower = indicators?.bbLower?.[lastIdx] || 0;
    const bbMiddle = indicators?.bbMiddle?.[lastIdx] || 1;
    const currentWidth = (bbUpper - bbLower) / bbMiddle;

    const prevBbUpper = lastIdx > 0 ? (indicators?.bbUpper?.[lastIdx - 1] || bbUpper) : bbUpper;
    const prevBbLower = lastIdx > 0 ? (indicators?.bbLower?.[lastIdx - 1] || bbLower) : bbLower;
    const prevBbMiddle = lastIdx > 0 ? (indicators?.bbMiddle?.[lastIdx - 1] || bbMiddle) : bbMiddle;
    const prevBbWidth = (prevBbUpper - prevBbLower) / (prevBbMiddle || 1);

    const isExpanding = currentWidth > prevBbWidth;

    const volumeMA = indicators?.volumeMA?.[lastIdx] || 1;
    const candleRange = high - low || 1;
    const bodyRatio = Math.abs(close - open) / candleRange;
    const upperWick = high - Math.max(open, close);
    const lowerWick = Math.min(open, close) - low;

    const marketContext = {
      regime,
      regimeCategory,
      volatilityState: {
        currentWidth,
        avgWidth: prevBbWidth,
        isExpanding,
        atr,
      },
      breakoutStrength: {
        bbWidth: currentWidth,
        prevBbWidth,
        bodyRatio,
        volumeRatio: volumeMA > 0 ? candles[lastIdx].volume / volumeMA : 1,
        upperWickRatio: upperWick / candleRange,
        lowerWickRatio: lowerWick / candleRange,
      },
      featureVector,
      probability,
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
