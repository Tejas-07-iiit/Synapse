export const SUPPORTED_INTERVALS = ["5m", "15m"] as const;

export type MarketInterval = typeof SUPPORTED_INTERVALS[number];

export function isValidInterval(interval: string): interval is MarketInterval {
  return SUPPORTED_INTERVALS.includes(interval as MarketInterval);
}

// Convert our standard intervals to Binance API intervals
export function toBinanceInterval(interval: MarketInterval): string {
  return interval; // They map 1:1 for "5m", "15m"
}
