import { StrategyContext } from "../types";

export class ConfidenceEngine {
  /**
   * Calculates a centralized confidence score (0 to 100) for a given trade setup.
   */
  public static calculate(
    direction: "LONG" | "SHORT" | "HOLD",
    context: StrategyContext
  ): number {
    if (direction === "HOLD") return 0;

    let score = 50; // Base starting score

    const { candles, indicators, historicalIndicators } = context;
    if (candles.length === 0) return score;

    const lastIdx = candles.length - 1;
    const price = candles[lastIdx].close;

    // 1. EMA Alignment (EMA 20 vs SMA 50 vs Price)
    const ema20 = indicators.ema20[lastIdx];
    const sma50 = indicators.sma50[lastIdx];
    if (ema20 && sma50) {
      if (direction === "LONG") {
        if (price > ema20 && ema20 > sma50) {
          score += 15; // Strong bullish trend alignment
        } else if (price < ema20 || ema20 < sma50) {
          score -= 10; // Conflicting trend
        }
      } else if (direction === "SHORT") {
        if (price < ema20 && ema20 < sma50) {
          score += 15; // Strong bearish trend alignment
        } else if (price > ema20 || ema20 > sma50) {
          score -= 10; // Conflicting trend
        }
      }
    }

    // 2. RSI Strength (overbought/oversold conditions supporting reversal, or trend support)
    const rsi = indicators.rsi[lastIdx] ?? 50;
    if (direction === "LONG") {
      if (rsi < 35) {
        score += 15; // Strong oversold buyer exhaustion
      } else if (rsi > 70) {
        score -= 15; // Overbought risk
      } else if (rsi > 50) {
        score += 5; // Bullish momentum
      }
    } else if (direction === "SHORT") {
      if (rsi > 65) {
        score += 15; // Strong overbought seller exhaustion
      } else if (rsi < 30) {
        score -= 15; // Oversold risk
      } else if (rsi < 50) {
        score += 5; // Bearish momentum
      }
    }

    // 3. MACD Agreement (MACD line vs signal line, and histogram sign)
    const macdHist = indicators.macdHist[lastIdx] ?? 0;
    if (direction === "LONG") {
      if (macdHist > 0) {
        score += 10; // Positive momentum confirmation
      } else {
        score -= 10; // Conflicting momentum
      }
    } else if (direction === "SHORT") {
      if (macdHist < 0) {
        score += 10; // Negative momentum confirmation
      } else {
        score -= 10; // Conflicting momentum
      }
    }

    // 4. Volume Confirmation (Volume exceeding moving average)
    const volume = candles[lastIdx].volume;
    const volumeMA = indicators.volumeMA[lastIdx] ?? 0;
    if (volumeMA > 0 && volume > volumeMA * 1.3) {
      score += 10; // High volume confirmations support breakouts/reversals
    }

    // 5. Volatility (Check Bollinger Band width and ATR comparison)
    const bbUpper = indicators.bbUpper[lastIdx];
    const bbLower = indicators.bbLower[lastIdx];
    const bbMiddle = indicators.bbMiddle[lastIdx];
    const atr = indicators.atr[lastIdx] ?? 0;
    
    if (bbUpper && bbLower && bbMiddle && atr > 0) {
      const bbWidth = (bbUpper - bbLower) / bbMiddle;
      // If volatility is expanding (breakout scenario), boost confidence
      if (bbWidth > 0.05) {
        score += 5;
      }
    }

    // 6. Momentum acceleration (MACD histogram expanding in the signal direction)
    const prevMacdHist = lastIdx > 0 ? (indicators.macdHist[lastIdx - 1] ?? 0) : 0;
    if (direction === "LONG" && macdHist > prevMacdHist) {
      score += 5;
    } else if (direction === "SHORT" && macdHist < prevMacdHist) {
      score += 5;
    }

    // 7. Candle Structure (Close relative to Open)
    const open = candles[lastIdx].open;
    const close = candles[lastIdx].close;
    if (direction === "LONG" && close > open) {
      score += 5; // Bullish candle
    } else if (direction === "SHORT" && close < open) {
      score += 5; // Bearish candle
    }

    // 8. Multi-timeframe Agreement (if other timeframes are calculated)
    if (historicalIndicators) {
      let mtfAgreements = 0;
      let mtfTotal = 0;
      for (const [, ind] of Object.entries(historicalIndicators)) {
        if (ind.rsi && ind.rsi.length > 0) {
          const tfRsi = ind.rsi[ind.rsi.length - 1];
          const tfMacdHist = ind.macdHist[ind.macdHist.length - 1] ?? 0;
          
          if (direction === "LONG" && tfRsi > 45 && tfMacdHist > 0) {
            mtfAgreements++;
          } else if (direction === "SHORT" && tfRsi < 55 && tfMacdHist < 0) {
            mtfAgreements++;
          }
          mtfTotal++;
        }
      }
      if (mtfTotal > 0 && mtfAgreements / mtfTotal >= 0.5) {
        score += 10; // Higher timeframe trend agreement
      }
    }

    // Clamp score strictly between 0 and 100
    return Math.min(100, Math.max(0, Math.round(score)));
  }
}
