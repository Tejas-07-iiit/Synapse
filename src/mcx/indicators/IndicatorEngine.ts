import type { McxCandle } from "@prisma/client";

export interface IndicatorSnapshot {
  sma?: number | null;
  ema?: number | null;
  rsi?: number | null;
  macdLine?: number | null;
  signalLine?: number | null;
  macdHistogram?: number | null;
  atr?: number | null;
  adx?: number | null;
  bbUpper?: number | null;
  bbMiddle?: number | null;
  bbLower?: number | null;
  vwap?: number | null;
  ema20?: number | null;
  ema50?: number | null;
  ema200?: number | null;
}

type CandleInput = Pick<McxCandle, "open" | "high" | "low" | "close" | "volume" | "timestamp" | "isClosed">;

function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  return values.slice(-period).reduce((sum, value) => sum + value, 0) / period;
}

function emaSeries(values: number[], period: number): Array<number | null> {
  if (values.length < period) return values.map(() => null);
  const k = 2 / (period + 1);
  const out: Array<number | null> = values.map(() => null);
  let prev = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i += 1) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

function lastNumber(values: Array<number | null>): number | null {
  for (let i = values.length - 1; i >= 0; i -= 1) {
    if (values[i] != null) return values[i] as number;
  }
  return null;
}

function rsi(values: number[], period = 14): number | null {
  if (values.length <= period) return null;
  let gains = 0;
  let losses = 0;
  const slice = values.slice(-(period + 1));
  for (let i = 1; i < slice.length; i += 1) {
    const delta = slice[i] - slice[i - 1];
    if (delta >= 0) gains += delta;
    else losses += Math.abs(delta);
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

function macd(values: number[]): Pick<IndicatorSnapshot, "macdLine" | "signalLine" | "macdHistogram"> {
  const fast = emaSeries(values, 12);
  const slow = emaSeries(values, 26);
  const macdValues = values.map((_, i) => (fast[i] == null || slow[i] == null ? null : (fast[i] as number) - (slow[i] as number)));
  const compact = macdValues.filter((value): value is number => value != null);
  const signal = emaSeries(compact, 9);
  const macdLine = compact.length ? compact[compact.length - 1] : null;
  const signalLine = lastNumber(signal);
  return {
    macdLine,
    signalLine,
    macdHistogram: macdLine != null && signalLine != null ? macdLine - signalLine : null,
  };
}

function atr(candles: CandleInput[], period = 14): number | null {
  if (candles.length <= period) return null;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i += 1) {
    const current = candles[i];
    const prev = candles[i - 1];
    trs.push(Math.max(current.high - current.low, Math.abs(current.high - prev.close), Math.abs(current.low - prev.close)));
  }
  return sma(trs, period);
}

function adx(candles: CandleInput[], period = 14): number | null {
  if (candles.length <= period + 1) return null;
  const plusDm: number[] = [];
  const minusDm: number[] = [];
  const tr: number[] = [];
  for (let i = 1; i < candles.length; i += 1) {
    const up = candles[i].high - candles[i - 1].high;
    const down = candles[i - 1].low - candles[i].low;
    plusDm.push(up > down && up > 0 ? up : 0);
    minusDm.push(down > up && down > 0 ? down : 0);
    tr.push(Math.max(candles[i].high - candles[i].low, Math.abs(candles[i].high - candles[i - 1].close), Math.abs(candles[i].low - candles[i - 1].close)));
  }
  const atrValue = sma(tr, period);
  const plus = sma(plusDm, period);
  const minus = sma(minusDm, period);
  if (!atrValue || plus == null || minus == null) return null;
  const plusDi = (100 * plus) / atrValue;
  const minusDi = (100 * minus) / atrValue;
  if (plusDi + minusDi === 0) return 0;
  return (100 * Math.abs(plusDi - minusDi)) / (plusDi + minusDi);
}

function bollinger(values: number[], period = 20, multiplier = 2): Pick<IndicatorSnapshot, "bbUpper" | "bbMiddle" | "bbLower"> {
  if (values.length < period) return { bbUpper: null, bbMiddle: null, bbLower: null };
  const slice = values.slice(-period);
  const middle = sma(slice, period) as number;
  const variance = slice.reduce((sum, value) => sum + Math.pow(value - middle, 2), 0) / period;
  const std = Math.sqrt(variance);
  return { bbUpper: middle + multiplier * std, bbMiddle: middle, bbLower: middle - multiplier * std };
}

function vwap(candles: CandleInput[]): number | null {
  const totals = candles.reduce(
    (acc, candle) => {
      const typical = (candle.high + candle.low + candle.close) / 3;
      return { pv: acc.pv + typical * candle.volume, volume: acc.volume + candle.volume };
    },
    { pv: 0, volume: 0 }
  );
  return totals.volume > 0 ? totals.pv / totals.volume : null;
}

export class IndicatorEngine {
  static calculate(candles: CandleInput[]): IndicatorSnapshot {
    const sorted = [...candles].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const values = sorted.map((c) => c.close);
    const ema20 = lastNumber(emaSeries(values, 20));
    const ema50 = lastNumber(emaSeries(values, 50));
    const ema200 = lastNumber(emaSeries(values, 200));
    return {
      sma: sma(values, 20),
      ema: ema20,
      ema20,
      ema50,
      ema200,
      rsi: rsi(values),
      ...macd(values),
      atr: atr(sorted),
      adx: adx(sorted),
      ...bollinger(values),
      vwap: vwap(sorted),
    };
  }

  static alignChart<T extends CandleInput & { token?: string; contractName?: string; expiry?: Date }>(candles: T[]) {
    const sorted = [...candles].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    return sorted
      .map((candle, index, all) => ({
        time: Math.floor(candle.timestamp.getTime() / 1000),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
        contractName: candle.contractName,
        token: candle.token,
        expiry: candle.expiry,
        isClosed: candle.isClosed,
        ...IndicatorEngine.calculate(all.slice(0, index + 1)),
      }));
  }
}
