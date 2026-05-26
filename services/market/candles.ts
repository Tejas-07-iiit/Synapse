import { Candle } from "@/types/market";
import { MarketInterval, toBinanceInterval } from "./intervals";

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

  // Type assertion to ensure strict typing and avoid 'any'
  const rawKlines = data as Array<Array<string | number>>;

  return rawKlines.map((item) => ({
    time: Number(item[0]),
    open: parseFloat(item[1] as string),
    high: parseFloat(item[2] as string),
    low: parseFloat(item[3] as string),
    close: parseFloat(item[4] as string),
    volume: parseFloat(item[5] as string),
  }));
}
