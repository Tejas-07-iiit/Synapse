/**
 * Calculates Exponential Moving Average (EMA) for an array of numbers.
 * The output array matches the length of the input array.
 */
export function calculateEMA(values: number[], period: number): number[] {
  const result: number[] = new Array(values.length);
  if (values.length === 0) return [];

  const k = 2 / (period + 1);
  let ema = values[0];
  result[0] = ema;

  for (let i = 1; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
    result[i] = ema;
  }
  return result;
}
