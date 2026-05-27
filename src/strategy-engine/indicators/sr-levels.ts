import { Candle } from "../types";

/**
 * Calculates Support and Resistance levels for a series of candles.
 * For each index, returns the closest support level below close, and closest resistance level above close.
 */
export function calculateSupportResistance(
  candles: Candle[],
  pivotWindow: number = 5
): { supportLevels: number[]; resistanceLevels: number[] } {
  const supportLevels: number[] = Array(candles.length).fill(0);
  const resistanceLevels: number[] = Array(candles.length).fill(0);

  if (candles.length < pivotWindow * 2 + 1) {
    // Return mock values if there are not enough candles
    for (let i = 0; i < candles.length; i++) {
      const close = candles[i].close;
      supportLevels[i] = close * 0.95;
      resistanceLevels[i] = close * 1.05;
    }
    return { supportLevels, resistanceLevels };
  }

  // Pre-fill initial indices
  for (let i = 0; i < pivotWindow * 2 + 1; i++) {
    const close = candles[i].close;
    supportLevels[i] = close * 0.95;
    resistanceLevels[i] = close * 1.05;
  }

  // Calculate dynamically for each index
  for (let i = pivotWindow * 2 + 1; i < candles.length; i++) {
    const currentClose = candles[i].close;

    const supports: number[] = [];
    const resistances: number[] = [];

    // Find pivot points up to current index (with lag to verify pivot)
    for (let j = pivotWindow; j <= i - pivotWindow; j++) {
      const targetLow = candles[j].low;
      const targetHigh = candles[j].high;

      let isPivotLow = true;
      let isPivotHigh = true;

      for (let k = j - pivotWindow; k <= j + pivotWindow; k++) {
        if (candles[k].low < targetLow) {
          isPivotLow = false;
        }
        if (candles[k].high > targetHigh) {
          isPivotHigh = false;
        }
      }

      if (isPivotLow) {
        supports.push(targetLow);
      }
      if (isPivotHigh) {
        resistances.push(targetHigh);
      }
    }

    // Find closest support level below current close
    const belowClose = supports.filter((s) => s < currentClose);
    if (belowClose.length > 0) {
      // Find maximum value below current close
      supportLevels[i] = Math.max(...belowClose);
    } else {
      supportLevels[i] = currentClose * 0.95; // Default fallback
    }

    // Find closest resistance level above current close
    const aboveClose = resistances.filter((r) => r > currentClose);
    if (aboveClose.length > 0) {
      // Find minimum value above current close
      resistanceLevels[i] = Math.min(...aboveClose);
    } else {
      resistanceLevels[i] = currentClose * 1.05; // Default fallback
    }
  }

  return { supportLevels, resistanceLevels };
}
