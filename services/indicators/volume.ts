import { Candle } from "@/types/market";
import { calculateSMA } from "./sma";

/**
 * Calculates the Moving Average of Volume.
 * Reuses the SMA calculation on volume values.
 */
export function calculateVolumeMA(candles: Candle[], period: number = 20): number[] {
  const volumes = candles.map((c) => c.volume);
  return calculateSMA(volumes, period);
}
