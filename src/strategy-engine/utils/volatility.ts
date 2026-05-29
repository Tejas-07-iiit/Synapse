import { Candle } from "../types";
import { calculateEMA } from "../indicators/ema";
import { calculateSMA } from "../indicators/sma";
import { calculateATR } from "../indicators/atr";
import { calculateBollingerBands } from "../indicators/bollinger";

/**
 * Volatility Utilities Engine
 * Reusable utility functions for volatility analysis, shared by Synapse strategies.
 */

/**
 * Calculates Average True Range (ATR).
 */
export function getATR(candles: Candle[], period: number = 14): number[] {
  return calculateATR(candles, period);
}

/**
 * Calculates ATR Percentage: (ATR / Close) * 100
 */
export function getATRPct(candles: Candle[], period: number = 14): number[] {
  const atr = calculateATR(candles, period);
  const atrPct: number[] = new Array(candles.length).fill(0);
  for (let i = 0; i < candles.length; i++) {
    atrPct[i] = candles[i].close > 0 ? (atr[i] / candles[i].close) * 100 : 0;
  }
  return atrPct;
}

/**
 * Calculates Bollinger Bands (Upper, Middle, Lower).
 */
export function getBollingerBands(closes: number[], period: number = 20, multiplier: number = 2): {
  upper: number[];
  middle: number[];
  lower: number[];
} {
  return calculateBollingerBands(closes, period, multiplier);
}

/**
 * Calculates Keltner Channels (Upper, Middle, Lower).
 * KC Middle Line = EMA(Close, Period)
 * KC Upper Band = Middle + Multiplier * ATR(Period)
 * KC Lower Band = Middle - Multiplier * ATR(Period)
 */
export function getKeltnerChannels(candles: Candle[], period: number = 20, multiplier: number = 1.5): {
  upper: number[];
  middle: number[];
  lower: number[];
} {
  const closes = candles.map(c => c.close);
  const middle = calculateEMA(closes, period);
  const atr = calculateATR(candles, period);

  const upper: number[] = new Array(candles.length).fill(0);
  const lower: number[] = new Array(candles.length).fill(0);

  for (let i = 0; i < candles.length; i++) {
    upper[i] = middle[i] + multiplier * atr[i];
    lower[i] = middle[i] - multiplier * atr[i];
  }

  return { upper, middle, lower };
}

/**
 * Detects Volatility Expansion: returns true if volatility (ATR) is expanding relative to its average.
 */
export function detectVolatilityExpansion(atr: number[], lookback: number = 5): boolean {
  if (atr.length < lookback + 1) return false;
  const lastIdx = atr.length - 1;
  
  // Calculate average of previous values (excluding the current tick)
  let sum = 0;
  const start = Math.max(0, lastIdx - lookback);
  for (let i = start; i < lastIdx; i++) {
    sum += atr[i];
  }
  const avgAtr = sum / (lastIdx - start);
  
  return atr[lastIdx] > avgAtr;
}

/**
 * Detects Bollinger Band Squeeze inside Keltner Channel.
 * Returns true if BB upper is below KC upper AND BB lower is above KC lower.
 */
export function getSqueezeState(closes: number[], candles: Candle[], period: number = 20, bbMult: number = 2, kcMult: number = 1.5): {
  squeezeOn: boolean[];
  bbUpper: number[];
  bbLower: number[];
  kcUpper: number[];
  kcLower: number[];
} {
  const len = closes.length;
  const squeezeOn: boolean[] = new Array(len).fill(false);

  const bb = calculateBollingerBands(closes, period, bbMult);
  const kc = getKeltnerChannels(candles, period, kcMult);

  for (let i = 0; i < len; i++) {
    squeezeOn[i] = bb.upper[i] < kc.upper[i] && bb.lower[i] > kc.lower[i];
  }

  return {
    squeezeOn,
    bbUpper: bb.upper,
    bbLower: bb.lower,
    kcUpper: kc.upper,
    kcLower: kc.lower
  };
}
