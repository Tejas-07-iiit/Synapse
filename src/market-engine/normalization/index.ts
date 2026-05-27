import { Candle, TickerInfo } from "../../strategy-engine/types";

export class NormalizerEngine {
  /**
   * Normalizes Binance raw klines array (REST response) into Candle objects.
   */
  public normalizeRestKlines(rawKlines: Array<Array<string | number>>): Candle[] {
    return rawKlines.map((item) => ({
      time: Number(item[0]),
      open: parseFloat(item[1] as string),
      high: parseFloat(item[2] as string),
      low: parseFloat(item[3] as string),
      close: parseFloat(item[4] as string),
      volume: parseFloat(item[5] as string),
    }));
  }

  /**
   * Normalizes a single Binance WebSocket kline payload into a Candle object.
   */
  public normalizeWsKline(k: {
    t: number;
    o: string;
    h: string;
    l: string;
    c: string;
    v: string;
  }): Candle {
    return {
      time: k.t,
      open: parseFloat(k.o),
      high: parseFloat(k.h),
      low: parseFloat(k.l),
      close: parseFloat(k.c),
      volume: parseFloat(k.v),
    };
  }

  /**
   * Normalizes a Binance WebSocket 24hr ticker payload into a TickerInfo object.
   */
  public normalizeWsTicker(data: {
    s: string;
    c: string;
    p: string;
    P: string;
    v: string;
    h: string;
    l: string;
    E: number;
  }): TickerInfo {
    return {
      symbol: data.s.toUpperCase(),
      price: parseFloat(data.c),
      priceChange24h: parseFloat(data.p),
      priceChangePercent24h: parseFloat(data.P),
      volume24h: parseFloat(data.v),
      high24h: parseFloat(data.h),
      low24h: parseFloat(data.l),
      lastUpdate: data.E,
    };
  }
}

export const normalizer = new NormalizerEngine();
