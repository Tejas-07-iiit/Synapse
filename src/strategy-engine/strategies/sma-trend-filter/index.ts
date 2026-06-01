import { TradingStrategy, StrategyContext, StrategySignal } from "../../types";
import { SignalGenerator } from "../../core/signal-generator";
import { RegimeEngine } from "../../core/regime-engine";

/**
 * SMA Trend Filter Strategy
 *
 * Major trend-following strategy that only trades in the direction of the macro trend
 * (SMA50 vs SMA200) and uses RSI to filter out overextended or poor entries.
 *
 * LONG:  SMA50 > SMA200 + price > SMA50 + RSI between 50 and 70 + SMA50 slope positive
 * SHORT: SMA50 < SMA200 + price < SMA50 + RSI between 30 and 50 + SMA50 slope negative
 *
 * Filters:
 *   - Reject RSI > 75 for longs (overbought protection)
 *   - Reject RSI < 25 for shorts (oversold protection)
 *   - Reject flat SMA50 (slope < 0.005%)
 *   - Reject weak trend structures (weak SMA50/SMA200 separation or ranging markets)
 *
 * Stop Loss: Below/above SMA50 or 1.5 × ATR
 * Take Profit: Minimum 2 × ATR
 */
export class SMATrendFilterStrategy implements TradingStrategy {
  public id = "sma-trend-filter";
  public name = "SMA Trend Filter";
  public description = "Trend-following system trading in the direction of SMA50/SMA200 macro alignment with RSI filters.";
  public type = "Trend Following";
  public timeframe = "1h";
  public timeframes = ["5m", "15m", "1h", "4h"];
  public symbols: string[] = [];
  public enabled = true;
  public indicatorsRequired = ["sma50", "rsi", "atr"];
  public supportedRegimes = ["Bullish Trend","Bearish Trend","Breakout","High Volatility"];

  private readonly minSMASeparation = 0.002;  // 0.2% minimum separation
  private readonly minSMA50Slope = 0.005;     // 0.005% minimum slope
  private readonly sma200Period = 200;

  // ────────────────────────────────────────────
  // Internal Indicator Calculators
  // ────────────────────────────────────────────

  private computeSMA(closes: number[], period: number): number[] {
    const sma: number[] = new Array(closes.length).fill(0);
    let sum = 0;
    for (let i = 0; i < closes.length; i++) {
      sum += closes[i];
      if (i >= period) sum -= closes[i - period];
      sma[i] = i >= period - 1 ? sum / period : sum / (i + 1);
    }
    return sma;
  }

  // ────────────────────────────────────────────
  // TradingStrategy Interface Implementation
  // ────────────────────────────────────────────

  public analyze(context: StrategyContext): { direction: "LONG" | "SHORT" | "HOLD"; reasoning: string[]; confidence: number } {
    const { candles, indicators } = context;
    const lastIdx = candles.length - 1;
    const close = candles[lastIdx].close;

    const closes = candles.map(c => c.close);
    const sma200 = this.computeSMA(closes, this.sma200Period);
    const sma50 = indicators.sma50;
    const rsi = indicators.rsi;

    const sma50Last = sma50[lastIdx];
    const sma50Prev = sma50[lastIdx - 1];
    const sma200Last = sma200[lastIdx];
    const rsiLast = rsi[lastIdx];

    // SMA50 slope (over 5 candles)
    const sma50_5ago = lastIdx >= 5 ? sma50[lastIdx - 5] : sma50Prev;
    const sma50Slope = sma50Last - sma50_5ago;
    const sma50SlopePercent = sma50_5ago > 0 ? (sma50Slope / sma50_5ago) * 100 : 0;
    const isSma50Flat = Math.abs(sma50SlopePercent) < this.minSMA50Slope;

    // SMA Separation
    const smaSeparation = Math.abs(sma50Last - sma200Last) / close;
    const isSmaSeparationWeak = smaSeparation < this.minSMASeparation;

    // Regime Check
    const regime = RegimeEngine.classify(context);
    const isRanging = regime === "Ranging" || regime === "Low Volatility";

    let direction: "LONG" | "SHORT" | "HOLD" = "HOLD";
    const reasoning: string[] = [];

    // --- Filters ---
    if (isRanging) {
      reasoning.push(`Ranging market regime detected (${regime}) — avoiding trend trades.`);
      return { direction: "HOLD", reasoning, confidence: 0 };
    }

    if (isSma50Flat) {
      reasoning.push(`SMA50 is flat (slope: ${sma50SlopePercent.toFixed(4)}%) — no active momentum.`);
      return { direction: "HOLD", reasoning, confidence: 0 };
    }

    if (isSmaSeparationWeak) {
      reasoning.push(`SMA50/SMA200 separation ${(smaSeparation * 100).toFixed(3)}% below minimum ${(this.minSMASeparation * 100).toFixed(2)}%.`);
      return { direction: "HOLD", reasoning, confidence: 0 };
    }

    // Overbought/Oversold extreme bounds
    if (rsiLast > 75) {
      reasoning.push(`RSI is overbought (${rsiLast.toFixed(1)} > 75) — risk of correction.`);
      return { direction: "HOLD", reasoning, confidence: 0 };
    }
    if (rsiLast < 25) {
      reasoning.push(`RSI is oversold (${rsiLast.toFixed(1)} < 25) — risk of bounce.`);
      return { direction: "HOLD", reasoning, confidence: 0 };
    }

    // --- LONG ---
    if (sma50Last > sma200Last && close > sma50Last && rsiLast >= 50 && rsiLast <= 70 && sma50Slope > 0) {
      direction = "LONG";
      reasoning.push("SMA Trend Filter LONG: SMA50 is above SMA200 (bullish macro trend).");
      reasoning.push(`Price ($${close.toFixed(2)}) is above SMA50 ($${sma50Last.toFixed(2)}).`);
      reasoning.push(`RSI is in the golden buy zone (${rsiLast.toFixed(1)} between 50 and 70).`);
      reasoning.push(`SMA50 is sloping upwards (${sma50SlopePercent.toFixed(3)}%).`);
    }

    // --- SHORT ---
    if (direction === "HOLD" && sma50Last < sma200Last && close < sma50Last && rsiLast >= 30 && rsiLast <= 50 && sma50Slope < 0) {
      direction = "SHORT";
      reasoning.push("SMA Trend Filter SHORT: SMA50 is below SMA200 (bearish macro trend).");
      reasoning.push(`Price ($${close.toFixed(2)}) is below SMA50 ($${sma50Last.toFixed(2)}).`);
      reasoning.push(`RSI is in the golden short zone (${rsiLast.toFixed(1)} between 30 and 50).`);
      reasoning.push(`SMA50 is sloping downwards (${sma50SlopePercent.toFixed(3)}%).`);
    }

    if (direction === "HOLD") {
      if (sma50Last > sma200Last && close > sma50Last) {
        reasoning.push(`SMA trend is bullish, but RSI (${rsiLast.toFixed(1)}) is outside 50-70 buy zone or SMA50 slope is negative.`);
      } else if (sma50Last < sma200Last && close < sma50Last) {
        reasoning.push(`SMA trend is bearish, but RSI (${rsiLast.toFixed(1)}) is outside 30-50 short zone or SMA50 slope is positive.`);
      } else {
        reasoning.push("SMA50 and SMA200 trend alignment does not match current price action.");
      }
    }

    // --- Confidence scoring ---
    let confidence = 0;
    if (direction !== "HOLD") {
      confidence = 55; // Base for trend alignment

      // SMA Separation magnitude
      if (smaSeparation > 0.015) confidence += 15;
      else if (smaSeparation > 0.008) confidence += 10;
      else confidence += 5;

      // SMA50 slope strength
      if (Math.abs(sma50SlopePercent) > 0.05) confidence += 15;
      else if (Math.abs(sma50SlopePercent) > 0.02) confidence += 10;
      else confidence += 5;

      // RSI Strength
      if (direction === "LONG") {
        // RSI close to 60 is optimal momentum
        const distFrom60 = Math.abs(rsiLast - 60);
        if (distFrom60 < 5) confidence += 15;
        else if (distFrom60 < 10) confidence += 10;
        else confidence += 5;
      } else {
        // RSI close to 40 is optimal momentum
        const distFrom40 = Math.abs(rsiLast - 40);
        if (distFrom40 < 5) confidence += 15;
        else if (distFrom40 < 10) confidence += 10;
        else confidence += 5;
      }

      confidence = Math.min(100, Math.max(0, Math.round(confidence)));
    }

    return { direction, reasoning, confidence };
  }

  public validate(context: StrategyContext): boolean {
    const { candles, indicators } = context;
    return (
      candles.length >= 210 && // SMA200 + buffer
      indicators.sma50 !== undefined &&
      indicators.sma50.length >= candles.length &&
      indicators.rsi !== undefined &&
      indicators.rsi.length >= candles.length &&
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
    const sma50Last = indicators.sma50[lastIdx];

    let stopLoss = 0;
    let takeProfit = 0;

    if (direction === "LONG") {
      const slSma = sma50Last - 0.2 * atr;
      const slAtr = close - 1.5 * atr;
      stopLoss = Math.max(slSma, slAtr);
      if (stopLoss >= close) stopLoss = close - 1.5 * atr;
      takeProfit = close + 2.5 * atr;
    } else if (direction === "SHORT") {
      const slSma = sma50Last + 0.2 * atr;
      const slAtr = close + 1.5 * atr;
      stopLoss = Math.min(slSma, slAtr);
      if (stopLoss <= close) stopLoss = close + 1.5 * atr;
      takeProfit = close - 2.5 * atr;
    }

    const signal = SignalGenerator.createSignal(this.id, direction, confidence, reasoning, context);

    if (direction !== "HOLD") {
      signal.stopLoss = Number(stopLoss.toFixed(4));
      signal.takeProfit = Number(takeProfit.toFixed(4));
    }

    // Attach computed indicators
    const closes = candles.map(c => c.close);
    const sma200 = this.computeSMA(closes, this.sma200Period);
    signal.indicators = {
      ...signal.indicators,
      sma200: sma200[lastIdx],
    };

    return signal;
  }

  public evaluate(context: StrategyContext): StrategySignal {
    if (!this.enabled || !this.validate(context)) {
      return SignalGenerator.createSignal(
        this.id,
        "HOLD",
        0,
        ["Strategy disabled or validation failed — need 210+ candles and required indicators."],
        context
      );
    }
    return this.generateSignal(context);
  }
}
