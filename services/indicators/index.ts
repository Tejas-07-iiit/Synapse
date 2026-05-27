import { Candle, IndicatorValues } from "@/types/market";
import { calculateAllIndicators as calculateAllNew } from "@/src/strategy-engine/indicators";

/**
 * Calculates all required technical indicators from a history of candles.
 * Returns an IndicatorValues structure with arrays matching the length of the input candles.
 * Delegates to the centralized Strategy Engine Indicator system.
 */
export function calculateAllIndicators(candles: Candle[]): IndicatorValues {
  return calculateAllNew("BTCUSDT", "15m", candles) as IndicatorValues;
}
