import { Candle } from "../../strategy-engine/types";
import { normalizer } from "../normalization";

export async function fetchHistoricalCandles(
  symbol: string,
  interval: string,
  limit: number = 500
): Promise<Candle[]> {
  // Direct 1:1 mapping as Binance supports "1m", "5m", "15m", "1h", "4h" natively.
  const binanceInterval = interval;
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=${binanceInterval}&limit=${limit}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch candles from Binance REST API: ${res.statusText}`);
  }

  const data = await res.json();
  if (!Array.isArray(data)) {
    throw new Error("Invalid klines format received from Binance API");
  }

  return normalizer.normalizeRestKlines(data as Array<Array<string | number>>);
}
