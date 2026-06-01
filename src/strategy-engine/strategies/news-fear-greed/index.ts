import { TradingStrategy, StrategyContext, StrategySignal } from "../../types";
import { SignalGenerator } from "../../core/signal-generator";

/**
 * News Fear & Greed Strategy
 *
 * Concept: Market psychology / contrarian strategy combining:
 *   - Fear & Greed Index (0-100)
 *   - News Sentiment Score (0-100)
 *   - Technical confirmation (RSI, EMA20, Momentum)
 *
 * Architecture: Uses a SentimentProvider abstraction. Currently runs in
 * MOCK mode, deriving sentiment proxies from technical indicators.
 * Future: API integration (Alternative.me, CryptoQuant, etc.).
 *
 * LONG:  Fear & Greed < 30 + sentiment improving + price stabilizing (contrarian)
 * SHORT: Fear & Greed > 80 + sentiment deteriorating + momentum weakening
 *
 * Confidence model: 40% FearGreed + 40% Sentiment + 20% Technical
 *
 * Stop Loss: ATR-based
 * Take Profit: Dynamic risk-reward
 */
export class NewsFearGreedStrategy implements TradingStrategy {
  public id = "news-fear-greed";
  public name = "News Fear & Greed Strategy";
  public description = "Contrarian market psychology strategy combining Fear & Greed Index, news sentiment, and technical confirmation.";
  public type = "Sentiment";
  public timeframe = "1h";
  public timeframes = ["15m", "1h", "4h"];
  public symbols: string[] = [];
  public enabled = true;
  public indicatorsRequired = ["rsi", "ema20", "atr", "macdHist"];
  public supportedRegimes = ["Bullish Trend","Bearish Trend","Breakout","High Volatility"];

  // ────────────────────────────────────────────
  // Mock Sentiment Provider
  // ────────────────────────────────────────────

  /**
   * SentimentProvider abstraction — Mock implementation.
   *
   * Derives Fear & Greed and Sentiment scores from technical indicators
   * as a proxy until live API integration is added.
   *
   * Future sources: Alternative.me Fear & Greed API, CryptoQuant, LunarCrush.
   *
   * Returns: { fearGreed: 0-100, sentimentScore: 0-100 }
   */
  private getSentimentData(context: StrategyContext): { fearGreed: number; sentimentScore: number } {
    const { candles, indicators } = context;
    const lastIdx = candles.length - 1;

    // --- Fear & Greed proxy ---
    // Based on RSI (volatility + momentum), volume ratio, and price position
    const rsi = indicators.rsi?.[lastIdx] ?? 50;
    const volume = candles[lastIdx].volume;
    const volumeMA = indicators.volumeMA?.[lastIdx] || volume;
    const volumeRatio = volumeMA > 0 ? volume / volumeMA : 1;

    // RSI contribution (RSI 20 → extreme fear, RSI 80 → extreme greed)
    const rsiComponent = Math.min(100, Math.max(0, rsi));

    // Volume surge component (high volume = more greed/fear amplification)
    const volumeComponent = Math.min(100, Math.max(0, volumeRatio * 50));

    // Bollinger position (below lower = fear, above upper = greed)
    const bbUpper = indicators.bbUpper?.[lastIdx] || 0;
    const bbLower = indicators.bbLower?.[lastIdx] || 0;
    const close = candles[lastIdx].close;
    let bbComponent = 50;
    if (bbUpper > bbLower && bbUpper > 0) {
      bbComponent = Math.min(100, Math.max(0, ((close - bbLower) / (bbUpper - bbLower)) * 100));
    }

    const fearGreed = Math.round(rsiComponent * 0.5 + volumeComponent * 0.2 + bbComponent * 0.3);

    // --- Sentiment score proxy ---
    // Derived from MACD histogram trend and momentum
    const macdHist = indicators.macdHist?.[lastIdx] ?? 0;
    const prevMacdHist = lastIdx > 0 ? (indicators.macdHist?.[lastIdx - 1] ?? 0) : 0;
    const macdImproving = macdHist > prevMacdHist;

    // Price momentum (5-candle)
    const priceMom = lastIdx >= 5 ? (close - candles[lastIdx - 5].close) / candles[lastIdx - 5].close : 0;

    // Compose sentiment: 50 is neutral, bullish data pushes higher
    let sentimentScore = 50;
    sentimentScore += macdImproving ? 15 : -15;
    sentimentScore += Math.min(20, Math.max(-20, priceMom * 200));
    sentimentScore += rsi > 50 ? 10 : -10;
    sentimentScore = Math.min(100, Math.max(0, Math.round(sentimentScore)));

    return { fearGreed, sentimentScore };
  }

  /**
   * Checks if sentiment is improving over last N candles.
   */
  private isSentimentImproving(context: StrategyContext, lookback: number = 3): boolean {
    const { candles, indicators } = context;
    const lastIdx = candles.length - 1;
    if (lastIdx < lookback) return false;

    // Use MACD histogram trend as sentiment proxy
    let improvingCount = 0;
    for (let i = 0; i < lookback; i++) {
      const idx = lastIdx - i;
      const prevIdx = idx - 1;
      if (prevIdx < 0) break;
      const hist = indicators.macdHist?.[idx] ?? 0;
      const prevHist = indicators.macdHist?.[prevIdx] ?? 0;
      if (hist > prevHist) improvingCount++;
    }
    return improvingCount >= Math.ceil(lookback / 2);
  }

  /**
   * Checks if sentiment is deteriorating.
   */
  private isSentimentDeteriorating(context: StrategyContext, lookback: number = 3): boolean {
    const { candles, indicators } = context;
    const lastIdx = candles.length - 1;
    if (lastIdx < lookback) return false;

    let deterioratingCount = 0;
    for (let i = 0; i < lookback; i++) {
      const idx = lastIdx - i;
      const prevIdx = idx - 1;
      if (prevIdx < 0) break;
      const hist = indicators.macdHist?.[idx] ?? 0;
      const prevHist = indicators.macdHist?.[prevIdx] ?? 0;
      if (hist < prevHist) deterioratingCount++;
    }
    return deterioratingCount >= Math.ceil(lookback / 2);
  }

  // ────────────────────────────────────────────
  // TradingStrategy interface
  // ────────────────────────────────────────────

  public analyze(context: StrategyContext): { direction: "LONG" | "SHORT" | "HOLD"; reasoning: string[]; confidence: number } {
    const { candles, indicators } = context;
    const lastIdx = candles.length - 1;
    const close = candles[lastIdx].close;

    const { fearGreed, sentimentScore } = this.getSentimentData(context);
    const sentimentImproving = this.isSentimentImproving(context);
    const sentimentDeteriorating = this.isSentimentDeteriorating(context);

    const rsiLast = indicators.rsi?.[lastIdx] ?? 50;
    const ema20Last = indicators.ema20[lastIdx];

    // Price stabilization check (low volatility in recent candles)
    const recentCandles = candles.slice(-5);
    const avgRange = recentCandles.reduce((sum, c) => sum + (c.high - c.low), 0) / recentCandles.length;
    const atr = indicators.atr?.[lastIdx] || (close * 0.015);
    const priceStabilizing = avgRange < atr * 0.8;

    // Momentum weakening
    const momentum = lastIdx >= 5 ? close - candles[lastIdx - 5].close : 0;
    const prevMomentum = lastIdx >= 6 ? candles[lastIdx - 1].close - candles[lastIdx - 6].close : 0;
    const momentumWeakening = Math.abs(momentum) < Math.abs(prevMomentum);

    let direction: "LONG" | "SHORT" | "HOLD" = "HOLD";
    const reasoning: string[] = [];

    // --- LONG: Extreme fear + improving sentiment + stabilizing price ---
    if (fearGreed < 30 && sentimentImproving && priceStabilizing) {
      // Technical confirmation: at least one must agree
      const rsiConfirms = rsiLast < 40; // Oversold
      const emaConfirms = close > ema20Last; // Price above EMA
      const momConfirms = momentum > 0; // Momentum turning positive

      if (rsiConfirms || emaConfirms || momConfirms) {
        direction = "LONG";
        reasoning.push(`Fear & Greed LONG: Extreme fear at ${fearGreed} (< 30) — contrarian buy signal.`);
        reasoning.push(`Sentiment improving (score: ${sentimentScore}).`);
        reasoning.push("Price showing stabilization after fear-driven sell-off.");
        if (rsiConfirms) reasoning.push(`RSI at ${rsiLast.toFixed(1)} confirms oversold conditions.`);
        if (emaConfirms) reasoning.push(`Price above EMA20 ($${ema20Last.toFixed(2)}) supports recovery.`);
        if (momConfirms) reasoning.push("Momentum turning positive — early recovery sign.");
      }
    }

    // --- SHORT: Extreme greed + deteriorating sentiment + momentum weakening ---
    if (direction === "HOLD" && fearGreed > 80 && sentimentDeteriorating && momentumWeakening) {
      const rsiConfirms = rsiLast > 65; // Overbought
      const emaConfirms = close < ema20Last; // Price below EMA
      const momConfirms = momentum < 0; // Momentum negative

      if (rsiConfirms || emaConfirms || momConfirms) {
        direction = "SHORT";
        reasoning.push(`Fear & Greed SHORT: Extreme greed at ${fearGreed} (> 80) — contrarian sell signal.`);
        reasoning.push(`Sentiment deteriorating (score: ${sentimentScore}).`);
        reasoning.push("Momentum weakening suggests exhaustion.");
        if (rsiConfirms) reasoning.push(`RSI at ${rsiLast.toFixed(1)} confirms overbought conditions.`);
        if (emaConfirms) reasoning.push(`Price below EMA20 ($${ema20Last.toFixed(2)}) confirms weakness.`);
        if (momConfirms) reasoning.push("Momentum has turned negative.");
      }
    }

    if (direction === "HOLD") {
      reasoning.push(`Fear & Greed at ${fearGreed}, Sentiment at ${sentimentScore} — no extreme detected.`);
    }

    // --- Confidence scoring: 40% FearGreed + 40% Sentiment + 20% Technical ---
    let confidence = 0;
    if (direction !== "HOLD") {
      // Fear/Greed component (40%)
      let fgScore = 0;
      if (direction === "LONG") {
        fgScore = Math.min(40, Math.round((30 - fearGreed) * 1.5)); // Lower = stronger
      } else {
        fgScore = Math.min(40, Math.round((fearGreed - 80) * 2.0)); // Higher = stronger
      }
      fgScore = Math.max(10, fgScore);

      // Sentiment component (40%)
      let sentScore = 0;
      if (direction === "LONG" && sentimentImproving) {
        sentScore = Math.min(40, Math.max(15, Math.round((50 - sentimentScore) * 0.8)));
      } else if (direction === "SHORT" && sentimentDeteriorating) {
        sentScore = Math.min(40, Math.max(15, Math.round((sentimentScore - 50) * 0.8)));
      }

      // Technical component (20%)
      let techScore = 5;
      if (direction === "LONG") {
        if (rsiLast < 30) techScore += 10;
        else if (rsiLast < 40) techScore += 5;
        if (close > ema20Last) techScore += 5;
      } else {
        if (rsiLast > 70) techScore += 10;
        else if (rsiLast > 65) techScore += 5;
        if (close < ema20Last) techScore += 5;
      }
      techScore = Math.min(20, techScore);

      confidence = fgScore + sentScore + techScore;
      confidence = Math.min(100, Math.max(0, Math.round(confidence)));
    }

    return { direction, reasoning, confidence };
  }

  public validate(context: StrategyContext): boolean {
    const { candles, indicators } = context;
    return (
      candles.length >= 20 &&
      indicators.rsi !== undefined &&
      indicators.rsi.length >= candles.length &&
      indicators.ema20 !== undefined &&
      indicators.ema20.length >= candles.length &&
      indicators.atr !== undefined &&
      indicators.atr.length >= candles.length &&
      indicators.macdHist !== undefined &&
      indicators.macdHist.length >= candles.length
    );
  }

  public generateSignal(context: StrategyContext): StrategySignal {
    const { direction, reasoning, confidence } = this.analyze(context);
    const { candles, indicators } = context;
    const lastIdx = candles.length - 1;
    const close = candles[lastIdx].close;
    const atr = indicators.atr[lastIdx] || (close * 0.015);

    const { fearGreed, sentimentScore } = this.getSentimentData(context);

    let stopLoss = 0;
    let takeProfit = 0;

    if (direction === "LONG") {
      stopLoss = close - 1.5 * atr;
      const risk = close - stopLoss;
      takeProfit = close + 2.5 * risk; // Dynamic RR — sentiment strategies benefit from wider TP
    } else if (direction === "SHORT") {
      stopLoss = close + 1.5 * atr;
      const risk = stopLoss - close;
      takeProfit = close - 2.5 * risk;
    }

    const signal = SignalGenerator.createSignal(
      this.id,
      direction,
      confidence,
      reasoning,
      context
    );

    if (direction !== "HOLD") {
      signal.stopLoss = Number(stopLoss.toFixed(4));
      signal.takeProfit = Number(takeProfit.toFixed(4));
    }

    // Attach sentiment data to indicators
    signal.indicators = {
      ...signal.indicators,
      fearGreed,
      sentimentScore,
    };

    return signal;
  }

  public evaluate(context: StrategyContext): StrategySignal {
    if (!this.enabled || !this.validate(context)) {
      return SignalGenerator.createSignal(
        this.id,
        "HOLD",
        0,
        ["Strategy disabled or validation failed due to insufficient indicator data."],
        context
      );
    }
    return this.generateSignal(context);
  }
}
