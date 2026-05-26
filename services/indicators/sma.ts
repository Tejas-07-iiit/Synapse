/**
 * Calculates Simple Moving Average (SMA) for an array of numbers.
 * The output array matches the length of the input array.
 * Initial elements prior to the period are filled with the values themselves to prevent chart dipping.
 */
export function calculateSMA(values: number[], period: number): number[] {
  const result: number[] = new Array(values.length);
  if (values.length === 0) return [];

  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) {
      sum -= values[i - period];
    }

    if (i >= period - 1) {
      result[i] = sum / period;
    } else {
      result[i] = values[i];
    }
  }
  return result;
}
