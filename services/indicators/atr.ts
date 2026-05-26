import { Candle } from "@/types/market";

/**
 * Calculates Average True Range (ATR) for an array of candles.
 * The output array matches the length of the input array.
 */
export function calculateATR(candles: Candle[], period: number = 14): number[] {
  const atr: number[] = new Array(candles.length);
  if (candles.length === 0) return [];

  // Default filler
  for (let i = 0; i < candles.length; i++) {
    atr[i] = 0;
  }

  if (candles.length === 1) {
    atr[0] = candles[0].high - candles[0].low;
    return atr;
  }

  // Calculate True Range (TR) values
  const tr: number[] = new Array(candles.length);
  tr[0] = candles[0].high - candles[0].low;

  for (let i = 1; i < candles.length; i++) {
    const highLow = candles[i].high - candles[i].low;
    const highPrevClose = Math.abs(candles[i].high - candles[i - 1].close);
    const lowPrevClose = Math.abs(candles[i].low - candles[i - 1].close);
    tr[i] = Math.max(highLow, highPrevClose, lowPrevClose);
  }

  // Calculate first ATR (simple average of TR over the first period)
  const limit = Math.min(period, candles.length);
  let trSum = 0;
  for (let i = 0; i < limit; i++) {
    trSum += tr[i];
  }
  const firstAtr = trSum / limit;
  atr[limit - 1] = firstAtr;

  // Fill in pre-limit values with a linear scale
  for (let i = 0; i < limit - 1; i++) {
    atr[i] = firstAtr * ((i + 1) / limit);
  }

  // Calculate subsequent ATR values using Wilder's smoothing
  for (let i = limit; i < candles.length; i++) {
    atr[i] = (atr[i - 1] * (period - 1) + tr[i]) / period;
  }

  return atr;
}
