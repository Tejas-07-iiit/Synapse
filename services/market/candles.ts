import { Candle } from "@/types/market";
import { MarketInterval, toBinanceInterval } from "./intervals";
import { normalizer } from "./normalizer";

export async function fetchHistoricalCandles(
  symbol: string,
  interval: MarketInterval,
  limit: number = 500
): Promise<Candle[]> {
  const binanceInterval = toBinanceInterval(interval);
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=${binanceInterval}&limit=${limit}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch candles from Binance: ${res.statusText}`);
  }

  const data = await res.json();
  if (!Array.isArray(data)) {
    throw new Error("Invalid klines format received from Binance API");
  }

  return normalizer.normalizeRestKlines(data as Array<Array<string | number>>);
}
