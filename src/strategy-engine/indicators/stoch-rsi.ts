import { calculateSMA } from "./sma";

/**
 * Calculates Stochastic RSI (K & D lines) for a given series of RSI values.
 */
export function calculateStochRSI(
  rsiValues: number[],
  period: number = 14,
  kPeriod: number = 3,
  dPeriod: number = 3
): { stochRsiK: number[]; stochRsiD: number[] } {

  if (rsiValues.length < period) {
    return {
      stochRsiK: Array(rsiValues.length).fill(50),
      stochRsiD: Array(rsiValues.length).fill(50),
    };
  }

  const rawStochRsi: number[] = Array(rsiValues.length).fill(50);

  // Compute raw StochRSI = (RSI - RSI_min) / (RSI_max - RSI_min) * 100
  for (let i = period - 1; i < rsiValues.length; i++) {
    const window = rsiValues.slice(i - period + 1, i + 1);
    const minRsi = Math.min(...window);
    const maxRsi = Math.max(...window);

    if (maxRsi === minRsi) {
      rawStochRsi[i] = 50;
    } else {
      rawStochRsi[i] = ((rsiValues[i] - minRsi) / (maxRsi - minRsi)) * 100;
    }
  }

  // Calculate %K = SMA(StochRSI, kPeriod)
  const computedK = calculateSMA(rawStochRsi, kPeriod);
  
  // Calculate %D = SMA(%K, dPeriod)
  const computedD = calculateSMA(computedK, dPeriod);

  return {
    stochRsiK: computedK,
    stochRsiD: computedD,
  };
}
