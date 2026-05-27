import { CandlestickPattern } from "./types";
import { Candle } from "../types";

class PatternRegistry {
  private patterns = new Map<string, CandlestickPattern>();

  public register(pattern: CandlestickPattern) {
    this.patterns.set(pattern.id, pattern);
  }

  public unregister(id: string) {
    this.patterns.delete(id);
  }

  public getPatterns(): CandlestickPattern[] {
    return Array.from(this.patterns.values());
  }
}

export const patternRegistry = new PatternRegistry();

// 1. Basic Doji Pattern Detector
export class DojiPattern implements CandlestickPattern {
  public id = "doji";
  public name = "Doji Pattern";
  public description = "Signifies market indecision; close and open prices are nearly equal.";
  public type = "NEUTRAL" as const;

  public detect(candles: Candle[]): boolean {
    if (candles.length === 0) return false;
    const last = candles[candles.length - 1];
    const bodySize = Math.abs(last.close - last.open);
    const totalRange = last.high - last.low;
    if (totalRange === 0) return false;
    return bodySize / totalRange < 0.1;
  }
}

// 2. Basic Hammer Pattern Detector
export class HammerPattern implements CandlestickPattern {
  public id = "hammer";
  public name = "Hammer Pattern";
  public description = "Bullish reversal pattern characterized by a small body and long lower wick.";
  public type = "BULLISH" as const;

  public detect(candles: Candle[]): boolean {
    if (candles.length < 2) return false;
    const last = candles[candles.length - 1];
    const bodySize = Math.abs(last.close - last.open);
    const totalRange = last.high - last.low;
    if (totalRange === 0) return false;
    
    const lowerWick = Math.min(last.open, last.close) - last.low;
    const upperWick = last.high - Math.max(last.open, last.close);

    return lowerWick > bodySize * 2 && upperWick < bodySize * 0.5;
  }
}

// Auto register built-in patterns
patternRegistry.register(new DojiPattern());
patternRegistry.register(new HammerPattern());
