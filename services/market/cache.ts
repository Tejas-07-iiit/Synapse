import { Candle } from "@/types/market";
import { MarketInterval } from "./intervals";

export class MarketCache {
  private cache: Map<string, Candle[]> = new Map();

  private getCacheKey(symbol: string, interval: MarketInterval): string {
    return `${symbol.toUpperCase()}_${interval}`;
  }

  public get(symbol: string, interval: MarketInterval): Candle[] | null {
    return this.cache.get(this.getCacheKey(symbol, interval)) || null;
  }

  public set(symbol: string, interval: MarketInterval, candles: Candle[]): void {
    // Keep a deep copy or copy of the array to prevent direct state mutation issues
    this.cache.set(this.getCacheKey(symbol, interval), [...candles]);
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
