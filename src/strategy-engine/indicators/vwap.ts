import { Candle } from "../types";

export function calculateVWAP(candles: Candle[]): number[] {
  const vwap: number[] = new Array(candles.length);
  if (candles.length === 0) return [];

  let cumulativeTypicalVolume = 0;
  let cumulativeVolume = 0;

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];
    const typicalPrice = (candle.high + candle.low + candle.close) / 3;
    
    cumulativeTypicalVolume += typicalPrice * candle.volume;
    cumulativeVolume += candle.volume;

    vwap[i] = cumulativeVolume === 0 ? typicalPrice : cumulativeTypicalVolume / cumulativeVolume;
  }

  return vwap;
}
