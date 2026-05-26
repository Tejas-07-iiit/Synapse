import { Candle, IndicatorValues, MarketAnalytics } from "@/types/market";

/**
 * Advanced analytics engine for Synapse.
 * Evaluates indicator arrays to compute trends, alignments, crossovers, regimes,
 * overall score, and dynamic natural language summaries.
 */
export function calculateMarketAnalytics(
  symbol: string,
  candles: Candle[],
  indicators: IndicatorValues
): MarketAnalytics {
  const lastIdx = candles.length - 1;
  const cleanSym = symbol.replace("USDT", "");

  // Fallback defaults for empty data
  if (lastIdx < 0) {
    return {
      symbol,
      trendDirection: "NEUTRAL",
      rsiStatus: "NEUTRAL",
      volatilityScore: "NORMAL",
      momentumScore: "NEUTRAL",
      volumeStrength: "NORMAL",
      marketRegime: "SIDEWAYS",
      emaAlignment: "NEUTRAL",
      bollingerPosition: "IN_CHANNEL",
      macdStatus: "NEUTRAL",
      marketScore: 50,
      summary: `${cleanSym} is awaiting data streaming connection.`,
    };
  }

  const price = candles[lastIdx].close;
  const prevPrice = lastIdx > 0 ? candles[lastIdx - 1].close : price;

  // 1. RSI Status
  let rsiStatus: "OVERBOUGHT" | "OVERSOLD" | "NEUTRAL" = "NEUTRAL";
  const rsi = indicators.rsi[lastIdx] ?? 50;
  if (rsi >= 70) {
    rsiStatus = "OVERBOUGHT";
  } else if (rsi <= 30) {
    rsiStatus = "OVERSOLD";
  }

  // 2. EMA Alignment (EMA 20 vs SMA 50)
  let emaAlignment: "BULLISH" | "BEARISH" | "NEUTRAL" = "NEUTRAL";
  const ema20 = indicators.ema20[lastIdx];
  const sma50 = indicators.sma50[lastIdx];
  if (ema20 && sma50) {
    if (ema20 > sma50 * 1.0005) {
      emaAlignment = "BULLISH";
    } else if (ema20 < sma50 * 0.9995) {
      emaAlignment = "BEARISH";
    }
  }

  // 3. Trend Direction (Price relation to EMA 20 and SMA 50)
  let trendDirection: "BULLISH" | "BEARISH" | "NEUTRAL" = "NEUTRAL";
  if (ema20 && sma50) {
    if (price > ema20 && ema20 > sma50) {
      trendDirection = "BULLISH";
    } else if (price < ema20 && ema20 < sma50) {
      trendDirection = "BEARISH";
    }
  }

  // 4. Volatility Score (Bollinger Band width compared to rolling average)
  let volatilityScore: "HIGH" | "LOW" | "NORMAL" = "NORMAL";
  const bbUpper = indicators.bbUpper[lastIdx];
  const bbLower = indicators.bbLower[lastIdx];
  const bbMiddle = indicators.bbMiddle[lastIdx];

  if (bbUpper && bbLower && bbMiddle) {
    const currentWidth = (bbUpper - bbLower) / bbMiddle;

    let widthSum = 0;
    let count = 0;
    const windowStart = Math.max(0, lastIdx - 20);
    for (let i = windowStart; i <= lastIdx; i++) {
      const u = indicators.bbUpper[i];
      const l = indicators.bbLower[i];
      const m = indicators.bbMiddle[i];
      if (u && l && m) {
        widthSum += (u - l) / m;
        count++;
      }
    }
    const avgWidth = count > 0 ? widthSum / count : currentWidth;

    if (currentWidth > avgWidth * 1.25) {
      volatilityScore = "HIGH";
    } else if (currentWidth < avgWidth * 0.75) {
      volatilityScore = "LOW";
    }
  }

  // 5. Bollinger Position
  let bollingerPosition: "ABOVE_UPPER" | "BELOW_LOWER" | "IN_CHANNEL" = "IN_CHANNEL";
  if (bbUpper && bbLower) {
    if (price > bbUpper) {
      bollingerPosition = "ABOVE_UPPER";
    } else if (price < bbLower) {
      bollingerPosition = "BELOW_LOWER";
    }
  }

  // 6. MACD Status (Crosses)
  let macdStatus: "BULLISH_CROSSOVER" | "BEARISH_CROSSOVER" | "NEUTRAL" = "NEUTRAL";
  const macdLine = indicators.macdLine[lastIdx];
  const signalLine = indicators.signalLine[lastIdx];
  const prevMacdLine = lastIdx > 0 ? indicators.macdLine[lastIdx - 1] : macdLine;
  const prevSignalLine = lastIdx > 0 ? indicators.signalLine[lastIdx - 1] : signalLine;

  if (macdLine !== undefined && signalLine !== undefined && prevMacdLine !== undefined && prevSignalLine !== undefined) {
    const lastDiff = macdLine - signalLine;
    const prevDiff = prevMacdLine - prevSignalLine;
    if (lastDiff > 0 && prevDiff <= 0) {
      macdStatus = "BULLISH_CROSSOVER";
    } else if (lastDiff < 0 && prevDiff >= 0) {
      macdStatus = "BEARISH_CROSSOVER";
    }
  }

  // 7. Momentum Score (MACD Histogram and RSI movement)
  let momentumScore: "STRONG" | "WEAK" | "NEUTRAL" = "NEUTRAL";
  const macdHistLast = indicators.macdHist[lastIdx] ?? 0;
  const macdHistPrev = lastIdx > 0 ? (indicators.macdHist[lastIdx - 1] ?? 0) : 0;
  const rsiPrev = lastIdx > 0 ? (indicators.rsi[lastIdx - 1] ?? rsi) : rsi;

  if (macdHistLast !== 0) {
    const isMacdRising = macdHistLast > macdHistPrev;
    const isRsiRising = rsi > rsiPrev;

    if (macdHistLast > 0 && isMacdRising && isRsiRising) {
      momentumScore = "STRONG";
    } else if (macdHistLast < 0 && !isMacdRising && !isRsiRising) {
      momentumScore = "WEAK";
    }
  }

  // 8. Volume Strength
  let volumeStrength: "HIGH" | "LOW" | "NORMAL" = "NORMAL";
  const currentVolume = candles[lastIdx].volume;
  const volumeMA = indicators.volumeMA[lastIdx];
  if (volumeMA && volumeMA > 0) {
    if (currentVolume > volumeMA * 1.4) {
      volumeStrength = "HIGH";
    } else if (currentVolume < volumeMA * 0.6) {
      volumeStrength = "LOW";
    }
  }

  // 9. Market Regime Detection
  let marketRegime: "BULLISH" | "BEARISH" | "SIDEWAYS" | "VOLATILE" | "ACCUMULATION" | "DISTRIBUTION" = "SIDEWAYS";
  if (trendDirection === "BULLISH" && emaAlignment === "BULLISH") {
    marketRegime = "BULLISH";
  } else if (trendDirection === "BEARISH" && emaAlignment === "BEARISH") {
    marketRegime = "BEARISH";
  } else if (volatilityScore === "HIGH") {
    marketRegime = "VOLATILE";
  } else if (rsi < 40 && macdHistLast > macdHistPrev && trendDirection === "NEUTRAL") {
    marketRegime = "ACCUMULATION";
  } else if (rsi > 60 && macdHistLast < macdHistPrev && trendDirection === "NEUTRAL") {
    marketRegime = "DISTRIBUTION";
  } else {
    marketRegime = "SIDEWAYS";
  }

  // 10. Quantitative Market Score (0 to 100)
  let scorePoints = 0;
  // Trend (Max 30)
  if (trendDirection === "BULLISH") scorePoints += 30;
  else if (trendDirection === "NEUTRAL") scorePoints += 15;
  // Alignment (Max 20)
  if (emaAlignment === "BULLISH") scorePoints += 20;
  else if (emaAlignment === "NEUTRAL") scorePoints += 10;
  // MACD Histogram (Max 20)
  if (macdHistLast > 0) scorePoints += 20;
  // Bollinger Relation (Max 20)
  if (bbMiddle && price > bbMiddle) scorePoints += 20;
  // RSI (Max 10)
  if (rsi > 50) scorePoints += 10;

  const marketScore = Math.min(100, Math.max(0, scorePoints));

  // 11. Intelligent Insight Generation (AI-style summary)
  let summary = "";
  if (marketRegime === "BULLISH") {
    summary = `${cleanSym} is displaying strong bullish conditions. Trading securely above its EMA(20) and SMA(50) support lines with buying momentum increasing.`;
  } else if (marketRegime === "BEARISH") {
    summary = `${cleanSym} is currently locked in a bearish markdown. The EMA alignment is negative, and price remains depressed below intermediate moving averages.`;
  } else if (marketRegime === "ACCUMULATION") {
    summary = `${cleanSym} is showing classic accumulation signals. RSI is recovering from oversold bounds (${rsi.toFixed(1)}) and bullish divergence is expanding.`;
  } else if (marketRegime === "DISTRIBUTION") {
    summary = `${cleanSym} volatility is flattening as it shows distribution traits. RSI is pulling back from overbought levels, indicating profit-taking distribution.`;
  } else if (marketRegime === "VOLATILE") {
    summary = `${cleanSym} volatility is surging with Bollinger Bands expanding. Watch for high-speed breakouts, particularly as MACD registers momentum crossovers.`;
  } else {
    summary = `${cleanSym} is trading sideways inside a ranging channel. Bollinger band squeeze (${volatilityScore.toLowerCase()}) indicates upcoming trend expansions.`;
  }

  // Inject additional indicator details
  if (rsiStatus === "OVERBOUGHT") {
    summary += " Caution is advised as indicators warn of extremely overbought thresholds.";
  } else if (rsiStatus === "OVERSOLD") {
    summary += " Buy interest is expected to intensify as sellers reach oversold exhaustion.";
  }

  return {
    symbol,
    trendDirection,
    rsiStatus,
    volatilityScore,
    momentumScore,
    volumeStrength,
    marketRegime,
    emaAlignment,
    bollingerPosition,
    macdStatus,
    marketScore,
    summary,
  };
}
