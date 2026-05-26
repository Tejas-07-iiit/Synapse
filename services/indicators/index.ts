import { Candle, IndicatorValues } from "@/types/market";
import { calculateSMA } from "./sma";
import { calculateEMA } from "./ema";
import { calculateRSI } from "./rsi";
import { calculateMACD } from "./macd";
import { calculateBollingerBands } from "./bollinger";
import { calculateATR } from "./atr";
import { calculateVWAP } from "./vwap";
import { calculateVolumeMA } from "./volume";

/**
 * Calculates all required technical indicators from a history of candles.
 * Returns an IndicatorValues structure with arrays matching the length of the input candles.
 */
export function calculateAllIndicators(candles: Candle[]): IndicatorValues {
  if (candles.length === 0) {
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
    };
  }

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
  };
}
