import { calculateEMA } from "./ema";

export interface MACDResult {
  macdLine: number[];
  signalLine: number[];
  macdHist: number[];
}

/**
 * Calculates MACD (Moving Average Convergence Divergence).
 * Returns macdLine, signalLine, and macdHist arrays of the same length as the input values.
 */
export function calculateMACD(
  values: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDResult {
  const emaFast = calculateEMA(values, fastPeriod);
  const emaSlow = calculateEMA(values, slowPeriod);

  const macdLine: number[] = new Array(values.length);
  for (let i = 0; i < values.length; i++) {
    macdLine[i] = emaFast[i] - emaSlow[i];
  }

  const signalLine = calculateEMA(macdLine, signalPeriod);

  const macdHist: number[] = new Array(values.length);
  for (let i = 0; i < values.length; i++) {
    macdHist[i] = macdLine[i] - signalLine[i];
  }

  return { macdLine, signalLine, macdHist };
}
