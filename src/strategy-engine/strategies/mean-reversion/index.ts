import { TradingStrategy, StrategyContext, StrategySignal } from "../../types";
import { SignalGenerator } from "../../core/signal-generator";

export class MeanReversionStrategy implements TradingStrategy {
  public id = "mean-reversion";
  public name = "Mean Reversion Strategy";
  public description = "Detect temporary price deviations from equilibrium and trade reversals back toward mean price.";
  public type = "Mean-Reversion";
  public timeframe = "15m";
  public timeframes = ["5m", "15m"];
  public symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
  public enabled = true;
  public indicatorsRequired = ["rsi", "atr", "ema20", "sma50"];

  public analyze(context: StrategyContext): { direction: "LONG" | "SHORT" | "HOLD"; reasoning: string[]; confidence: number } {
    const { candles, indicators } = context;
    const lastIdx = candles.length - 1;
    const close = candles[lastIdx].close;
    const rsiLast = indicators.rsi[lastIdx];
    const rsiPrev = lastIdx > 0 ? indicators.rsi[lastIdx - 1] : 50;
    const atr = indicators.atr[lastIdx] || (close * 0.015);
    const ema20 = indicators.ema20[lastIdx] || close;
    const sma50 = indicators.sma50[lastIdx] || close;
    const macdHist = indicators.macdHist[lastIdx] || 0;
    const prevMacdHist = lastIdx > 0 ? indicators.macdHist[lastIdx - 1] : 0;

    // Calculate 10-bar Support & Resistance
    const last10 = candles.slice(-10);
    const last10Lows = last10.map((c) => c.low);
    const last10Highs = last10.map((c) => c.high);
    const support = Math.min(...last10Lows);
    const resistance = Math.max(...last10Highs);

    // Volatility calculation
    const volatility = (resistance - support) / close;

    let direction: "LONG" | "SHORT" | "HOLD" = "HOLD";
    const reasoning: string[] = [];

    // LONG Conditions:
    // 1. RSI14 < 30
    // 2. Price near 10-bar support (within 1.5%)
    // 3. Volatility not extremely high (volatility < 0.05)
    // 4. Candle rejection from support (low tested support and close closed above support)
    // 5. No strong bearish trend (macdHist not strongly negative)
    const isOversold = rsiLast < 30;
    const nearSupport = close <= support * 1.015;
    const moderateVolatility = volatility < 0.05;
    const rejectionSupport = candles[lastIdx].low <= support * 1.002 && close > support;
    const noStrongBearishTrend = macdHist >= -0.001 * close;

    // SHORT Conditions:
    // 1. RSI14 > 70
    // 2. Price near 10-bar resistance (within 1.5%)
    // 3. Volatility not extremely high (volatility < 0.05)
    // 4. Rejection from resistance (high tested resistance and close closed below resistance)
    // 5. No strong bullish trend (macdHist not strongly positive)
    const isOverbought = rsiLast > 70;
    const nearResistance = close >= resistance * 0.985;
    const rejectionResistance = candles[lastIdx].high >= resistance * 0.998 && close < resistance;
    const noStrongBullishTrend = macdHist <= 0.001 * close;

    if (isOversold && nearSupport && moderateVolatility && rejectionSupport && noStrongBearishTrend) {
      direction = "LONG";
      reasoning.push(`Mean Reversion LONG Triggered.`);
      reasoning.push(`RSI is oversold at ${rsiLast.toFixed(1)}.`);
      reasoning.push(`Price rejected near 10-bar support level $${support.toFixed(2)}.`);
      reasoning.push(`Market volatility is moderate at ${(volatility * 100).toFixed(2)}%.`);
    } else if (isOverbought && nearResistance && moderateVolatility && rejectionResistance && noStrongBullishTrend) {
      direction = "SHORT";
      reasoning.push(`Mean Reversion SHORT Triggered.`);
      reasoning.push(`RSI is overbought at ${rsiLast.toFixed(1)}.`);
      reasoning.push(`Price rejected near 10-bar resistance level $${resistance.toFixed(2)}.`);
      reasoning.push(`Market volatility is moderate at ${(volatility * 100).toFixed(2)}%.`);
    } else {
      reasoning.push("No mean reversion setup detected.");
    }

    // Confidence scoring engine:
    // confidence = trendScore + rsiScore + macdScore + momentumScore + volatilityScore
    let confidence = 0;
    if (direction !== "HOLD") {
      const trendScore = direction === "LONG" ? (ema20 >= sma50 ? 20 : 10) : (ema20 <= sma50 ? 20 : 10);
      const rsiScore = direction === "LONG" ? (rsiLast < 25 ? 25 : 20) : (rsiLast > 75 ? 25 : 20);
      const macdScore = direction === "LONG" ? (macdHist > prevMacdHist ? 15 : 10) : (macdHist < prevMacdHist ? 15 : 10);
      const momentumScore = direction === "LONG" ? (close > candles[lastIdx].open ? 20 : 10) : (close < candles[lastIdx].open ? 20 : 10);
      const volatilityScore = volatility < 0.03 ? 20 : (volatility < 0.05 ? 15 : 5);
      confidence = trendScore + rsiScore + macdScore + momentumScore + volatilityScore;
    }

    return { direction, reasoning, confidence };
  }

  public validate(context: StrategyContext): boolean {
    const { candles, indicators } = context;
    return (
      candles.length >= 10 &&
      indicators.rsi !== undefined &&
      indicators.rsi.length >= candles.length &&
      indicators.atr !== undefined &&
      indicators.atr.length >= candles.length &&
      indicators.ema20 !== undefined &&
      indicators.ema20.length >= candles.length &&
      indicators.sma50 !== undefined &&
      indicators.sma50.length >= candles.length
    );
  }

  public generateSignal(context: StrategyContext): StrategySignal {
    const { direction, reasoning, confidence } = this.analyze(context);
    const { candles, indicators } = context;
    const lastIdx = candles.length - 1;
    const close = candles[lastIdx].close;
    const atr = indicators.atr[lastIdx] || (close * 0.015);

    // Calculate S/R levels for SL/TP
    const last10 = candles.slice(-10);
    const support = Math.min(...last10.map((c) => c.low));
    const resistance = Math.max(...last10.map((c) => c.high));

    let stopLoss = 0;
    let takeProfit = 0;

    if (direction === "LONG") {
      stopLoss = Math.min(support - 1.0 * atr, close * 0.985);
      takeProfit = (support + resistance) / 2; // Midpoint range
      if (takeProfit <= close) {
        takeProfit = close + 1.5 * atr; // Fallback
      }
    } else if (direction === "SHORT") {
      stopLoss = Math.max(resistance + 1.0 * atr, close * 1.015);
      takeProfit = (support + resistance) / 2; // Midpoint range
      if (takeProfit >= close) {
        takeProfit = close - 1.5 * atr; // Fallback
      }
    }

    const signal = SignalGenerator.createSignal(
      this.id,
      direction,
      confidence,
      reasoning,
      context
    );

    // Override the custom SL/TP levels in the generated signal
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
        ["Strategy disabled or validation failed due to insufficient indicators data."],
        context
      );
    }
    return this.generateSignal(context);
  }
}
