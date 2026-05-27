export function calculateRSI(values: number[], period: number = 14): number[] {
  const rsi: number[] = new Array(values.length);
  if (values.length === 0) return [];

  // Default filler
  for (let i = 0; i < values.length; i++) {
    rsi[i] = 50;
  }

  if (values.length < 2) return rsi;

  let avgGain = 0;
  let avgLoss = 0;

  const limit = Math.min(period, values.length - 1);
  let gainSum = 0;
  let lossSum = 0;

  for (let i = 1; i <= limit; i++) {
    const diff = values[i] - values[i - 1];
    if (diff > 0) {
      gainSum += diff;
    } else {
      lossSum -= diff;
    }
  }

  avgGain = gainSum / period;
  avgLoss = lossSum / period;

  if (values.length > limit) {
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi[limit] = 100 - 100 / (1 + rs);

    for (let i = limit + 1; i < values.length; i++) {
      const diff = values[i] - values[i - 1];
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? -diff : 0;

      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;

      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsi[i] = 100 - 100 / (1 + rs);
    }
  }

  // Smooth out the pre-limit values for chart aesthetics
  const firstRealRsi = rsi[limit];
  for (let i = 0; i < limit; i++) {
    rsi[i] = 50 + (firstRealRsi - 50) * (i / limit);
  }

  return rsi;
}
