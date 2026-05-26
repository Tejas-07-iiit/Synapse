import { Candle } from "@/types/market";
import { MarketInterval } from "./intervals";

interface CacheEntry {
  candles: Candle[];
  timestamp: number;
}

const CACHE_TTL_MS = 30_000; // 30 seconds TTL

export class MarketCache {
  private cache: Map<string, CacheEntry> = new Map();

  private getCacheKey(symbol: string, interval: MarketInterval): string {
    return `${symbol.toUpperCase()}_${interval}`;
  }

  public get(symbol: string, interval: MarketInterval): Candle[] | null {
    const entry = this.cache.get(this.getCacheKey(symbol, interval));
    if (!entry) return null;

    // Expire stale entries
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      this.cache.delete(this.getCacheKey(symbol, interval));
      return null;
    }

    return entry.candles;
  }

  public set(symbol: string, interval: MarketInterval, candles: Candle[]): void {
    // Keep a copy of the array to prevent direct state mutation issues
    this.cache.set(this.getCacheKey(symbol, interval), {
      candles: [...candles],
      timestamp: Date.now(),
    });
  }

  public clear(symbol?: string, interval?: MarketInterval): void {
    if (symbol && interval) {
      this.cache.delete(this.getCacheKey(symbol, interval));
    } else if (symbol) {
      const prefix = `${symbol.toUpperCase()}_`;
      const keysToDelete = Array.from(this.cache.keys()).filter((key) => key.startsWith(prefix));
      keysToDelete.forEach((key) => this.cache.delete(key));
    } else {
      this.cache.clear();
    }
  }
}

export const marketCache = new MarketCache();
