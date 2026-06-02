import { TradingMode,  TradingStrategy, StrategyContext, StrategySignal } from "../../types";
import { SignalGenerator } from "../../core/signal-generator";

/**
 * Hash Ribbons Strategy
 *
 * Concept: Detects Bitcoin miner capitulation and recovery phases using
 * hashrate moving average crossovers. Historically one of the most reliable
 * indicators for major BTC bottoms.
 *
 * Implementation: Uses a HashrateProvider abstraction. Currently runs in
 * MOCK mode deriving a hashrate proxy from price/volume data.
 * Future: Glassnode, CoinMetrics, Blockchain.com API integration.
 *
 * LONG:  Hashrate SMA30 crosses above SMA60 (recovery from capitulation)
 * SHORT: HOLD only (no aggressive shorts — this is a bottom-finding strategy)
 *
 * Filter: Only activates for BTCUSDT.
 *
 * Stop Loss: 2 × ATR
 * Take Profit: Trend-following (3 × ATR)
 */
export class HashRibbonsStrategy implements TradingStrategy {
  public id = "hash-ribbons";
  public category: TradingMode = TradingMode.INTRADAY;
  public expectedHoldingTime = "1h-8h";
  public name = "Hash Ribbons Strategy";
  public description = "Detects Bitcoin miner capitulation and recovery using hashrate moving average crossovers for major bottom identification.";
  public type = "Sentiment";
  public timeframe = "4h";
  public timeframes = ["1h", "4h"];
  public symbols = ["BTCUSDT"]; // BTC only
  public enabled = true;
  public indicatorsRequired = ["atr", "rsi", "ema20"];
  public supportedRegimes = ["Bullish Trend","Bearish Trend","Breakout","High Volatility"];

  private readonly smaShortPeriod = 30;
  private readonly smaLongPeriod = 60;

  // ────────────────────────────────────────────
  // Mock Hashrate Provider
  // ────────────────────────────────────────────

  /**
   * Generates a mock hashrate proxy from price and volume data.
   *
   * In production, this would call a HashrateProvider that fetches
   * real-time hashrate data from Glassnode / CoinMetrics / Blockchain.com.
   *
   * The proxy uses: hashrate_proxy ∝ volume × (close / open) smoothing
   * This captures miner activity correlation with volume and price strength.
   */
  private getHashrateProxy(candles: { open: number; close: number; volume: number }[]): number[] {
    const hashrate: number[] = new Array(candles.length).fill(0);
    if (candles.length === 0) return hashrate;

    // Base proxy: volume-weighted price strength
    for (let i = 0; i < candles.length; i++) {
      const priceStrength = candles[i].open > 0 ? candles[i].close / candles[i].open : 1;
      hashrate[i] = candles[i].volume * priceStrength;
    }

    // Smooth with a short EMA to reduce noise
    const smoothPeriod = 5;
    const k = 2 / (smoothPeriod + 1);
    for (let i = 1; i < hashrate.length; i++) {
      hashrate[i] = hashrate[i] * k + hashrate[i - 1] * (1 - k);
    }

    return hashrate;
  }

  /**
   * Simple Moving Average over a numeric array.
   */
  private sma(values: number[], period: number): number[] {
    const result: number[] = new Array(values.length).fill(0);
    let sum = 0;
    for (let i = 0; i < values.length; i++) {
      sum += values[i];
      if (i >= period) sum -= values[i - period];
      result[i] = i >= period - 1 ? sum / period : sum / (i + 1);
    }
    return result;
  }

  // ────────────────────────────────────────────
  // TradingStrategy interface
  // ────────────────────────────────────────────

  public analyze(context: StrategyContext): { direction: "LONG" | "SHORT" | "HOLD"; reasoning: string[]; confidence: number } {
    const { candles, indicators, symbol } = context;
    const lastIdx = candles.length - 1;
    const reasoning: string[] = [];

    // --- Symbol filter: BTC only ---
    if (!symbol.includes("BTC")) {
      reasoning.push("Hash Ribbons: Strategy only applies to BTCUSDT. Skipping.");
      return { direction: "HOLD", reasoning, confidence: 0 };
    }

    // --- Hashrate proxy and SMAs ---
    const hashrateProxy = this.getHashrateProxy(candles);
    const sma30 = this.sma(hashrateProxy, this.smaShortPeriod);
    const sma60 = this.sma(hashrateProxy, this.smaLongPeriod);

    const sma30Last = sma30[lastIdx];
    const sma30Prev = sma30[lastIdx - 1];
    const sma60Last = sma60[lastIdx];
    const sma60Prev = sma60[lastIdx - 1];

    // Capitulation: SMA30 < SMA60
    const wasCapitulating = sma30Prev < sma60Prev;
    // Recovery: SMA30 crosses above SMA60
    const isBullishCross = sma30Prev <= sma60Prev && sma30Last > sma60Last;
    // Currently in recovery
    const isRecoveryPhase = sma30Last > sma60Last && wasCapitulating;

    // Capitulation duration (how many candles SMA30 < SMA60 lookback)
    let capitulationDuration = 0;
    for (let i = lastIdx - 1; i >= 0 && sma30[i] < sma60[i]; i--) {
      capitulationDuration++;
    }

    // Recovery strength: the delta between SMA30 and SMA60
    const recoveryStrength = sma60Last > 0 ? (sma30Last - sma60Last) / sma60Last : 0;

    // RSI for supplemental confirmation
    const rsiLast = indicators.rsi?.[lastIdx] ?? 50;

    let direction: "LONG" | "SHORT" | "HOLD" = "HOLD";

    // --- LONG: Recovery crossover detected ---
    if (isBullishCross) {
      direction = "LONG";
      reasoning.push("Hash Ribbons LONG: Hashrate SMA30 crossed above SMA60 — miner recovery signal.");
      reasoning.push(`Capitulation lasted ${capitulationDuration} candles.`);
      reasoning.push(`Recovery strength: ${(recoveryStrength * 100).toFixed(2)}%.`);
    }

    // --- No SHORT — Hash Ribbons is a bottom-finding strategy ---
    if (direction === "HOLD") {
      if (sma30Last < sma60Last) {
        reasoning.push(`Hash Ribbons: Miner capitulation phase (SMA30 < SMA60). Waiting for recovery.`);
      } else {
        reasoning.push("Hash Ribbons: No new recovery crossover detected.");
      }
    }

    // --- Confidence scoring ---
    let confidence = 0;
    if (direction !== "HOLD") {
      confidence = 50; // Base

      // Fresh crossover is much stronger than continuation
      if (isBullishCross) confidence += 15;

      // Longer capitulation = stronger bottom signal
      if (capitulationDuration > 30) confidence += 15;
      else if (capitulationDuration > 15) confidence += 10;
      else confidence += 5;

      // Recovery strength
      if (recoveryStrength > 0.05) confidence += 10;
      else if (recoveryStrength > 0.02) confidence += 5;

      // RSI confirmation (oversold zone supports bottom thesis)
      if (rsiLast < 40) confidence += 10;
      else if (rsiLast < 50) confidence += 5;

      confidence = Math.min(100, Math.max(0, Math.round(confidence)));
    }

    return { direction, reasoning, confidence };
  }

  public validate(context: StrategyContext): boolean {
    const { candles, indicators } = context;
    return (
      candles.length >= 65 && // smaLongPeriod + buffer
      indicators.atr !== undefined &&
      indicators.atr.length >= candles.length
    );
  }

  public generateSignal(context: StrategyContext): StrategySignal {
    const { direction, reasoning, confidence } = this.analyze(context);
    const { candles, indicators } = context;
    const lastIdx = candles.length - 1;
    const close = candles[lastIdx].close;
    const atr = indicators.atr[lastIdx] || (close * 0.015);

    let stopLoss = 0;
    let takeProfit = 0;

    if (direction === "LONG") {
      stopLoss = close - 2.0 * atr;   // Wider stop for sentiment-based strategy
      takeProfit = close + 3.0 * atr;  // Trend-following TP
    }
    // No SHORT signals for this strategy

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

    return signal;
  }

  public evaluate(context: StrategyContext): StrategySignal {
    if (!this.enabled || !this.validate(context)) {
      return SignalGenerator.createSignal(
        this.id,
        "HOLD",
        0,
        ["Strategy disabled or validation failed due to insufficient data."],
        context
      );
    }
    return this.generateSignal(context);
  }
}
