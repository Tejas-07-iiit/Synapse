import { Candle } from "../types";
import { calculateSMA } from "./sma";

export function calculateVolumeMA(candles: Candle[], period: number = 20): number[] {
  const volumes = candles.map((c) => c.volume);
  return calculateSMA(volumes, period);
}
