/**
 * Calculates the Momentum indicator over a specified period.
 * Momentum = Close_t - Close_{t-n}
 */
export function calculateMomentum(closes: number[], period: number = 12): number[] {
  const len = closes.length;
  const mom: number[] = new Array(len).fill(0); // Default to 0

  for (let i = period; i < len; i++) {
    mom[i] = closes[i] - closes[i - period];
  }

  return mom;
}
