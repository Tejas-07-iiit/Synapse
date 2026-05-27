import { Candle, IndicatorValues } from "../types";
import { calculateEMA } from "./ema";
import { calculateSMA } from "./sma";
import { calculateRSI } from "./rsi";
import { calculateMACD } from "./macd";
import { calculateBollingerBands } from "./bollinger";
import { calculateATR } from "./atr";
import { calculateVWAP } from "./vwap";
import { calculateVolumeMA } from "./volume";
import { calculateStochRSI } from "./stoch-rsi";
import { calculateADX } from "./adx";
import { calculateSupportResistance } from "./sr-levels";

// Caching and Memoization layer
interface IndicatorCacheEntry {
  candles: Candle[];
  indicators: IndicatorValues;
}

const indicatorCache = new Map<string, IndicatorCacheEntry>();

export function getIndicatorCacheKey(symbol: string, timeframe: string): string {
  return `${symbol.toUpperCase()}_${timeframe.toLowerCase()}`;
}

export function clearIndicatorCache(): void {
  indicatorCache.clear();
}

/**
 * Main calculation method. Integrates caching and decides whether to run a full
 * historical recalculation or perform a faster incremental update.
 */
export function calculateAllIndicators(
  symbol: string,
  timeframe: string,
  candles: Candle[]
): IndicatorValues {
  if (candles.length === 0) {
    return createEmptyIndicators();
  }

  const cacheKey = getIndicatorCacheKey(symbol, timeframe);
  const cached = indicatorCache.get(cacheKey);

  // If no cache exists, or candles are entirely different (e.g., initial fetch), calculate from scratch
  if (!cached || cached.candles.length === 0 || candles.length < 5) {
    const computed = computeFullIndicators(candles);
    indicatorCache.set(cacheKey, { candles: [...candles], indicators: computed });
    return computed;
  }

  const cachedCandles = cached.candles;
  const cachedIndicators = cached.indicators;

  const lastCachedIndex = cachedCandles.length - 1;
  const lastIncoming = candles[candles.length - 1];
  const lastCached = cachedCandles[lastCachedIndex];

  // Case 1: Intra-candle tick update (same time, last candle values changed)
  if (candles.length === cachedCandles.length && lastIncoming.time === lastCached.time) {
    // Make copies of cached indicator arrays to avoid mutating the cache directly
    const updatedIndicators = copyIndicatorValues(cachedIndicators);
    const lastIdx = candles.length - 1;

    // Recalculate indicators at the last index
    const closes = candles.map((c) => c.close);
    
    // Recalculating the tail of EMAs, SMAs, etc.
    const ema12Full = calculateEMA(closes, 12);
    const ema26Full = calculateEMA(closes, 26);
    const ema20Full = calculateEMA(closes, 20);
    const sma50Full = calculateSMA(closes, 50);
    const rsiFull = calculateRSI(closes, 14);
    const macdFull = calculateMACD(closes, 12, 26, 9);
    const bbFull = calculateBollingerBands(closes, 20, 2);
    const atrFull = calculateATR(candles, 14);
    const vwapFull = calculateVWAP(candles);
    const volumeMAFull = calculateVolumeMA(candles, 20);

    // New indicators calculation
    const stochRsiFull = calculateStochRSI(rsiFull, 14, 3, 3);
    const adxFull = calculateADX(candles, 14);
    const srFull = calculateSupportResistance(candles, 5);

    updatedIndicators.ema12[lastIdx] = ema12Full[lastIdx];
    updatedIndicators.ema26[lastIdx] = ema26Full[lastIdx];
    updatedIndicators.ema20[lastIdx] = ema20Full[lastIdx];
    updatedIndicators.sma50[lastIdx] = sma50Full[lastIdx];
    updatedIndicators.rsi[lastIdx] = rsiFull[lastIdx];
    updatedIndicators.macdLine[lastIdx] = macdFull.macdLine[lastIdx];
    updatedIndicators.signalLine[lastIdx] = macdFull.signalLine[lastIdx];
    updatedIndicators.macdHist[lastIdx] = macdFull.macdHist[lastIdx];
    updatedIndicators.bbUpper[lastIdx] = bbFull.upper[lastIdx];
    updatedIndicators.bbMiddle[lastIdx] = bbFull.middle[lastIdx];
    updatedIndicators.bbLower[lastIdx] = bbFull.lower[lastIdx];
    updatedIndicators.atr[lastIdx] = atrFull[lastIdx];
    updatedIndicators.vwap[lastIdx] = vwapFull[lastIdx];
    updatedIndicators.volumeMA[lastIdx] = volumeMAFull[lastIdx];
    
    updatedIndicators.stochRsiK[lastIdx] = stochRsiFull.stochRsiK[lastIdx];
    updatedIndicators.stochRsiD[lastIdx] = stochRsiFull.stochRsiD[lastIdx];
    updatedIndicators.adx[lastIdx] = adxFull[lastIdx];
    updatedIndicators.supportLevels[lastIdx] = srFull.supportLevels[lastIdx];
    updatedIndicators.resistanceLevels[lastIdx] = srFull.resistanceLevels[lastIdx];

    return updatedIndicators;
  }

  // Case 2: Incremental candle closed (incoming candle is new)
  if (candles.length === cachedCandles.length + 1 && candles[candles.length - 2].time === lastCached.time) {
    const computed = computeFullIndicators(candles);
    indicatorCache.set(cacheKey, { candles: [...candles], indicators: computed });
    return computed;
  }

  // Fallback: Default to full recalculation if lengths diverge significantly
  const computed = computeFullIndicators(candles);
  indicatorCache.set(cacheKey, { candles: [...candles], indicators: computed });
  return computed;
}

function createEmptyIndicators(): IndicatorValues {
  return {
    ema12: [],
    ema26: [],
    ema20: [],
    sma50: [],
    rsi: [],
    macdLine: [],
    signalLine: [],
    macdHist: [],
    bbUpper: [],
    bbMiddle: [],
    bbLower: [],
    atr: [],
    vwap: [],
    volumeMA: [],
    stochRsiK: [],
    stochRsiD: [],
    adx: [],
    supportLevels: [],
    resistanceLevels: [],
  };
}

function copyIndicatorValues(src: IndicatorValues): IndicatorValues {
  return {
    ema12: [...src.ema12],
    ema26: [...src.ema26],
    ema20: [...src.ema20],
    sma50: [...src.sma50],
    rsi: [...src.rsi],
    macdLine: [...src.macdLine],
    signalLine: [...src.signalLine],
    macdHist: [...src.macdHist],
    bbUpper: [...src.bbUpper],
    bbMiddle: [...src.bbMiddle],
    bbLower: [...src.bbLower],
    atr: [...src.atr],
    vwap: [...src.vwap],
    volumeMA: [...src.volumeMA],
    stochRsiK: [...src.stochRsiK],
    stochRsiD: [...src.stochRsiD],
    adx: [...src.adx],
    supportLevels: [...src.supportLevels],
    resistanceLevels: [...src.resistanceLevels],
  };
}

function computeFullIndicators(candles: Candle[]): IndicatorValues {
  const closes = candles.map((c) => c.close);

  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const ema20 = calculateEMA(closes, 20);
  const sma50 = calculateSMA(closes, 50);
  const rsi = calculateRSI(closes, 14);

  const { macdLine, signalLine, macdHist } = calculateMACD(closes, 12, 26, 9);
  const { upper: bbUpper, middle: bbMiddle, lower: bbLower } = calculateBollingerBands(closes, 20, 2);

  const atr = calculateATR(candles, 14);
  const vwap = calculateVWAP(candles);
  const volumeMA = calculateVolumeMA(candles, 20);

  const { stochRsiK, stochRsiD } = calculateStochRSI(rsi, 14, 3, 3);
  const adx = calculateADX(candles, 14);
  const { supportLevels, resistanceLevels } = calculateSupportResistance(candles, 5);

  return {
    ema12,
    ema26,
    ema20,
    sma50,
    rsi,
    macdLine,
    signalLine,
    macdHist,
    bbUpper,
    bbMiddle,
    bbLower,
    atr,
    vwap,
    volumeMA,
    stochRsiK,
    stochRsiD,
    adx,
    supportLevels,
    resistanceLevels,
  };
}
