import { Candle } from "../types";

/**
 * Calculates the Money Flow Index (MFI) over a specified period.
 * MFI = 100 - (100 / (1 + MoneyFlowRatio))
 */
export function calculateMFI(candles: Candle[], period: number = 14): number[] {
  const len = candles.length;
  const mfi: number[] = new Array(len).fill(50); // Default to neutral 50

  if (len < period + 1) {
    return mfi;
  }

  // Calculate Typical Price for each candle
  const typicalPrices = candles.map((c) => (c.high + c.low + c.close) / 3);
  
  // Calculate Raw Money Flow for each candle
  const moneyFlows = candles.map((c, i) => typicalPrices[i] * c.volume);

  for (let i = period; i < len; i++) {
    let positiveFlow = 0;
    let negativeFlow = 0;

    // Sum positive and negative flows over the period
    for (let j = i - period + 1; j <= i; j++) {
      if (typicalPrices[j] > typicalPrices[j - 1]) {
        positiveFlow += moneyFlows[j];
      } else if (typicalPrices[j] < typicalPrices[j - 1]) {
        negativeFlow += moneyFlows[j];
      }
    }

    if (negativeFlow === 0) {
      mfi[i] = 100;
    } else {
      const moneyFlowRatio = positiveFlow / negativeFlow;
      mfi[i] = 100 - 100 / (1 + moneyFlowRatio);
    }
  }

  return mfi;
}
