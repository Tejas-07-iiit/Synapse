import { Candle } from "../types";
import { patternRegistry } from "./registry";

export interface DetectedPattern {
  patternId: string;
  patternName: string;
  type: "BULLISH" | "BEARISH" | "NEUTRAL";
  description: string;
  timestamp: number;
}

export class CandlestickDetectorEngine {
  /**
   * Scans the candle series and returns all patterns detected on the latest candle.
   */
  public static detectPatterns(candles: Candle[]): DetectedPattern[] {
    if (candles.length === 0) return [];
    const lastCandle = candles[candles.length - 1];
    const detected: DetectedPattern[] = [];

    const registered = patternRegistry.getPatterns();
    for (const pattern of registered) {
      if (pattern.detect(candles)) {
        detected.push({
          patternId: pattern.id,
          patternName: pattern.name,
          type: pattern.type,
          description: pattern.description,
          timestamp: lastCandle.time,
        });
      }
    }

    return detected;
  }
}
