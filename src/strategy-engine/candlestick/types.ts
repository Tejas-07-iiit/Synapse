import { Candle } from "../types";

export interface CandlestickPattern {
  id: string;
  name: string;
  description: string;
  type: "BULLISH" | "BEARISH" | "NEUTRAL";
  
  /**
   * Detects if the candlestick pattern is present at the end of the series.
   */
  detect(candles: Candle[]): boolean;
}
