import { Candle } from "../types";

/**
 * Calculates Average Directional Index (ADX) over a given period (usually 14).
 * Returns series of ADX values.
 */
export function calculateADX(candles: Candle[], period: number = 14): number[] {
  const adxValues: number[] = Array(candles.length).fill(0);

  if (candles.length <= period * 2) {
    return adxValues;
  }

  const tr: number[] = Array(candles.length).fill(0);
  const plusDM: number[] = Array(candles.length).fill(0);
  const minusDM: number[] = Array(candles.length).fill(0);

  // 1. Calculate TR, +DM, -DM
  for (let i = 1; i < candles.length; i++) {
    const cur = candles[i];
    const prev = candles[i - 1];

    // True Range (TR)
    const hL = cur.high - cur.low;
    const hC = Math.abs(cur.high - prev.close);
    const lC = Math.abs(cur.low - prev.close);
    tr[i] = Math.max(hL, hC, lC);

    // Directional Movement (+DM, -DM)
    const upMove = cur.high - prev.high;
    const downMove = prev.low - cur.low;

    if (upMove > downMove && upMove > 0) {
      plusDM[i] = upMove;
    } else {
      plusDM[i] = 0;
    }

    if (downMove > upMove && downMove > 0) {
      minusDM[i] = downMove;
    } else {
      minusDM[i] = 0;
    }
  }

  // 2. Smooth TR, +DM, -DM using Wilder's smoothing technique
  const smoothedTR: number[] = Array(candles.length).fill(0);
  const smoothedPlusDM: number[] = Array(candles.length).fill(0);
  const smoothedMinusDM: number[] = Array(candles.length).fill(0);

  // Initial sum for the first 'period' values
  let trSum = 0;
  let plusDmSum = 0;
  let minusDmSum = 0;
  for (let i = 1; i <= period; i++) {
    trSum += tr[i];
    plusDmSum += plusDM[i];
    minusDmSum += minusDM[i];
  }

  smoothedTR[period] = trSum;
  smoothedPlusDM[period] = plusDmSum;
  smoothedMinusDM[period] = minusDmSum;

  for (let i = period + 1; i < candles.length; i++) {
    smoothedTR[i] = smoothedTR[i - 1] - smoothedTR[i - 1] / period + tr[i];
    smoothedPlusDM[i] = smoothedPlusDM[i - 1] - smoothedPlusDM[i - 1] / period + plusDM[i];
    smoothedMinusDM[i] = smoothedMinusDM[i - 1] - smoothedMinusDM[i - 1] / period + minusDM[i];
  }

  // 3. Compute +DI, -DI, and DX
  const dx: number[] = Array(candles.length).fill(0);
  for (let i = period; i < candles.length; i++) {
    const trVal = smoothedTR[i];
    if (trVal === 0) {
      dx[i] = 0;
      continue;
    }

    const plusDI = (smoothedPlusDM[i] / trVal) * 100;
    const minusDI = (smoothedMinusDM[i] / trVal) * 100;

    const diff = Math.abs(plusDI - minusDI);
    const sum = plusDI + minusDI;

    dx[i] = sum === 0 ? 0 : (diff / sum) * 100;
  }

  // 4. Smooth DX to get ADX
  let dxSum = 0;
  for (let i = period; i < period * 2; i++) {
    dxSum += dx[i];
  }

  adxValues[period * 2 - 1] = dxSum / period;

  for (let i = period * 2; i < candles.length; i++) {
    adxValues[i] = (adxValues[i - 1] * (period - 1) + dx[i]) / period;
  }

  return adxValues;
}
