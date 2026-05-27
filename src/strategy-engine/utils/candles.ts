import { Candle } from "../types";

export class CandleUtils {
  /**
   * Validates a list of candles to ensure there are no corrupted OHLCV values.
   */
  public static validate(candles: Candle[]): boolean {
    if (candles.length === 0) return false;
    for (const c of candles) {
      if (
        isNaN(c.time) ||
        isNaN(c.open) ||
        isNaN(c.high) ||
        isNaN(c.low) ||
        isNaN(c.close) ||
        isNaN(c.volume) ||
        c.open <= 0 ||
        c.high <= 0 ||
        c.low <= 0 ||
        c.close <= 0
      ) {
        return false;
      }
    }
    return true;
  }

  /**
   * Converts standard candles to Heikin-Ashi candles for smoothed trend visualizations.
   */
  public static toHeikinAshi(candles: Candle[]): Candle[] {
    if (candles.length === 0) return [];
    
    const haCandles: Candle[] = [];
    
    // First candle
    const first = candles[0];
    let prevOpen = first.open;
    let prevClose = first.close;

    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];
      const haClose = (c.open + c.high + c.low + c.close) / 4;
      const haOpen = i === 0 ? (c.open + c.close) / 2 : (prevOpen + prevClose) / 2;
      const haHigh = Math.max(c.high, haOpen, haClose);
      const haLow = Math.min(c.low, haOpen, haClose);

      haCandles.push({
        time: c.time,
        open: haOpen,
        high: haHigh,
        low: haLow,
        close: haClose,
        volume: c.volume,
      });

      prevOpen = haOpen;
      prevClose = haClose;
    }

    return haCandles;
  }
}
