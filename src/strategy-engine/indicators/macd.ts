import { calculateEMA } from "./ema";

export interface MACDResult {
  macdLine: number[];
  signalLine: number[];
  macdHist: number[];
}

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
    macdLine[i] = (emaFast[i] || 0) - (emaSlow[i] || 0);
  }

  const signalLine = calculateEMA(macdLine, signalPeriod);

  const macdHist: number[] = new Array(values.length);
  for (let i = 0; i < values.length; i++) {
    macdHist[i] = macdLine[i] - (signalLine[i] || 0);
  }

  return { macdLine, signalLine, macdHist };
}
