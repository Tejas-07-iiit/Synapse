import { calculateSMA } from "./sma";

export interface BollingerResult {
  upper: number[];
  middle: number[];
  lower: number[];
}

export function calculateBollingerBands(
  values: number[],
  period: number = 20,
  multiplier: number = 2
): BollingerResult {
  const middle = calculateSMA(values, period);
  const upper: number[] = new Array(values.length);
  const lower: number[] = new Array(values.length);

  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      upper[i] = values[i];
      lower[i] = values[i];
      continue;
    }

    let sumDiffSq = 0;
    const avg = middle[i];
    for (let j = i - period + 1; j <= i; j++) {
      const diff = values[j] - avg;
      sumDiffSq += diff * diff;
    }
    const stdDev = Math.sqrt(sumDiffSq / period);

    upper[i] = avg + stdDev * multiplier;
    lower[i] = avg - stdDev * multiplier;
  }

  return { upper, middle, lower };
}
