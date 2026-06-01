import { TradingStrategy, StrategyContext, StrategySignal } from "../../types";
import { SignalGenerator } from "../../core/signal-generator";
import { RegimeEngine } from "../../core/regime-engine";

export class ShortTermReversalStrategy implements TradingStrategy {
  public id = "short-term-reversal";
  public name = "Short Term Reversal Strategy";
  public description = "Trade quick pullback reversals from EMA50 support or extension when RSI and Momentum indicate exhaustion.";
  public type = "Reversal";
  public timeframe = "15m";
  public timeframes = ["5m", "15m"];
  public symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
  public enabled = true;
  public indicatorsRequired = ["rsi", "atr", "ema20", "sma50", "momentum"];
  public supportedRegimes = ["Ranging","Accumulation","Distribution","Low Volatility"];

  public analyze(context: StrategyContext): { direction: "LONG" | "SHORT" | "HOLD"; reasoning: string[]; confidence: number } {
    const { candles, indicators } = context;
    const lastIdx = candles.length - 1;
    const close = candles[lastIdx].close;
    const open = candles[lastIdx].open;
    const low = candles[lastIdx].low;

    const rsi = indicators.rsi[lastIdx];
    const atr = indicators.atr[lastIdx] || (close * 0.015);
    const sma50 = indicators.sma50[lastIdx];
    
    const momentum = indicators.momentum?.[lastIdx] ?? 0;
    const prevMomentum = lastIdx > 0 ? (indicators.momentum?.[lastIdx - 1] ?? 0) : 0;

    let direction: "LONG" | "SHORT" | "HOLD" = "HOLD";
    const reasoning: string[] = [];

    // LONG Conditions:
    // 1. RSI < 30 (oversold)
    // 2. Momentum deeply negative: momentum < -1.5 * atr
    // 3. Selling momentum slowdown: momentum > prevMomentum (turning up)
    // 4. Price touches/tests SMA50 support: low <= sma50 * 1.005 and close >= sma50 * 0.99
    const rsiOversold = rsi < 30;
    const momentumDeeplyNegative = momentum < -1.5 * atr;
    const sellingSlowdown = momentum > prevMomentum;
    const testsSma50Support = low <= sma50 * 1.005 && close >= sma50 * 0.99;

    // SHORT Conditions:
    // 1. RSI > 70 (overbought)
    // 2. Momentum strongly positive: momentum > 1.5 * atr
    // 3. Buying exhaustion confirmed: momentum < prevMomentum (turning down)
    // 4. Price extended above SMA50: close >= sma50 * 1.015 or close >= sma50 + 1.5 * atr
    const rsiOverbought = rsi > 70;
    const momentumStronglyPositive = momentum > 1.5 * atr;
    const buyingExhaustion = momentum < prevMomentum;
    const extendedAboveSma50 = close >= sma50 * 1.015 || close >= sma50 + 1.5 * atr;

    if (rsiOversold && momentumDeeplyNegative && sellingSlowdown && testsSma50Support) {
      direction = "LONG";
      reasoning.push("Short Term Reversal LONG Triggered.");
      reasoning.push(`Price tested SMA50 support ($${sma50.toFixed(2)}) with low at $${low.toFixed(2)}.`);
      reasoning.push(`RSI is oversold at ${rsi.toFixed(1)}.`);
      reasoning.push(`Momentum is deeply negative ($${momentum.toFixed(2)}) and starting to slow down (prev: $${prevMomentum.toFixed(2)}).`);
    } else if (rsiOverbought && momentumStronglyPositive && buyingExhaustion && extendedAboveSma50) {
      direction = "SHORT";
      reasoning.push("Short Term Reversal SHORT Triggered.");
      reasoning.push(`Price is extended above SMA50 ($${sma50.toFixed(2)}) with close at $${close.toFixed(2)}.`);
      reasoning.push(`RSI is overbought at ${rsi.toFixed(1)}.`);
      reasoning.push(`Momentum is strongly positive ($${momentum.toFixed(2)}) and showing exhaustion (prev: $${prevMomentum.toFixed(2)}).`);
    } else {
      reasoning.push("No short-term pullback/exhaustion reversal setups detected.");
    }

    let confidence = 0;
    if (direction !== "HOLD") {
      const rsiDevScore = direction === "LONG" ? Math.max(0, 30 - rsi) : Math.max(0, rsi - 70);
      const rsiScore = Math.min(30, Math.round(rsiDevScore * 3)); // Max 30 points
      const momScore = Math.min(40, Math.round(Math.abs(momentum) / atr * 10)); // Max 40 points
      
      // Check if closing in favor of reversal
      const candleBodyScore = direction === "LONG" ? (close > open ? 30 : 10) : (close < open ? 30 : 10);
      
      confidence = Math.min(100, Math.max(30, rsiScore + momScore + candleBodyScore));
    }

    return { direction, reasoning, confidence };
  }

  public validate(context: StrategyContext): boolean {
    const { candles, indicators } = context;
    return (
      candles.length >= 20 &&
      indicators.rsi !== undefined &&
      indicators.atr !== undefined &&
      indicators.ema20 !== undefined &&
      indicators.sma50 !== undefined &&
      indicators.momentum !== undefined &&
      indicators.rsi.length >= candles.length &&
      indicators.atr.length >= candles.length &&
      indicators.ema20.length >= candles.length &&
      indicators.sma50.length >= candles.length &&
      indicators.momentum.length >= candles.length
    );
  }

  public generateSignal(context: StrategyContext): StrategySignal {
    const { direction, reasoning, confidence } = this.analyze(context);
    const { candles, indicators } = context;
    const lastIdx = candles.length - 1;
    const close = candles[lastIdx].close;
    const high = candles[lastIdx].high;
    const low = candles[lastIdx].low;
    const atr = indicators.atr[lastIdx] || (close * 0.015);
    const ema20 = indicators.ema20[lastIdx] || close;

    let stopLoss = 0;
    let takeProfit = 0;

    if (direction === "LONG") {
      stopLoss = low - 0.5 * atr;
      if (stopLoss >= close) {
        stopLoss = close - 1.5 * atr;
      }
      takeProfit = ema20;
      if (takeProfit <= close || (takeProfit - close) < 1.2 * (close - stopLoss)) {
        takeProfit = close + 1.5 * (close - stopLoss);
      }
    } else if (direction === "SHORT") {
      stopLoss = high + 0.5 * atr;
      if (stopLoss <= close) {
        stopLoss = close + 1.5 * atr;
      }
      takeProfit = ema20;
      if (takeProfit >= close || (close - takeProfit) < 1.2 * (stopLoss - close)) {
        takeProfit = close - 1.5 * (stopLoss - close);
      }
    }

    const regime = RegimeEngine.classify(context);
    const regimeCategory = RegimeEngine.getRegimeCategory(context);

    const bbUpper = indicators.bbUpper?.[lastIdx] || close * 1.02;
    const bbLower = indicators.bbLower?.[lastIdx] || close * 0.98;
    const bbMiddle = indicators.bbMiddle?.[lastIdx] || close;
    const bbWidth = bbMiddle > 0 ? (bbUpper - bbLower) / bbMiddle : 0;

    const marketContext = {
      regime,
      regimeCategory,
      volatilityState: {
        currentWidth: bbWidth,
        avgWidth: bbWidth,
        isExpanding: false,
        atr,
      },
      breakoutStrength: {
        bbWidth,
        prevBbWidth: bbWidth,
        bodyRatio: Math.abs(close - candles[lastIdx].open) / (high - low || 1),
        volumeRatio: 1.0,
        upperWickRatio: (high - Math.max(candles[lastIdx].open, close)) / (high - low || 1),
        lowerWickRatio: (Math.min(candles[lastIdx].open, close) - low) / (high - low || 1),
      },
      mfi: indicators.mfi?.[lastIdx],
      momentum: indicators.momentum?.[lastIdx],
    };

    const signal = SignalGenerator.createSignal(
      this.id,
      direction,
      confidence,
      reasoning,
      context,
      marketContext
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
        ["Strategy disabled or validation failed due to insufficient indicators data."],
        context
      );
    }
    return this.generateSignal(context);
  }
}
