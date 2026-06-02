import { TradingMode,  TradingStrategy, StrategyContext, StrategySignal } from "../../types";
import { SignalGenerator } from "../../core/signal-generator";
import { RegimeEngine } from "../../core/regime-engine";

export class BollingerReversionStrategy implements TradingStrategy {
  public id = "bollinger-reversion";
  public category: TradingMode = TradingMode.SCALPING;
  public expectedHoldingTime = "5m-45m";
  public name = "Bollinger Reversion Strategy";
  public description = "Detect price exhaustion outside Bollinger Bands and trade reversions back toward equilibrium in ranging markets.";
  public type = "MeanReversion";
  public timeframe = "1m";
  public timeframes = ["1m", "3m", "5m"];
  public symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
  public enabled = true;
  public indicatorsRequired = ["bbUpper", "bbMiddle", "bbLower", "adx", "rsi", "atr"];
  public supportedRegimes = ["Ranging","Accumulation","Distribution","Low Volatility"];

  public analyze(context: StrategyContext): { direction: "LONG" | "SHORT" | "HOLD"; reasoning: string[]; confidence: number } {
    const { candles, indicators } = context;
    const lastIdx = candles.length - 1;
    const close = candles[lastIdx].close;
    const open = candles[lastIdx].open;
    const high = candles[lastIdx].high;
    const low = candles[lastIdx].low;

    const bbUpper = indicators.bbUpper[lastIdx];
    const bbMiddle = indicators.bbMiddle[lastIdx];
    const bbLower = indicators.bbLower[lastIdx];
    const rsi = indicators.rsi[lastIdx];
    const adx = indicators.adx[lastIdx];

    // Volatility width stability check
    const bbWidth = bbMiddle > 0 ? (bbUpper - bbLower) / bbMiddle : 0.05;
    const prevBbUpper = lastIdx > 0 ? (indicators.bbUpper[lastIdx - 1] || bbUpper) : bbUpper;
    const prevBbLower = lastIdx > 0 ? (indicators.bbLower[lastIdx - 1] || bbLower) : bbLower;
    const prevBbMiddle = lastIdx > 0 ? (indicators.bbMiddle[lastIdx - 1] || bbMiddle) : bbMiddle;
    const prevBbWidth = prevBbMiddle > 0 ? (prevBbUpper - prevBbLower) / prevBbMiddle : bbWidth;
    
    // Stabilizing if band width is not expanding dramatically
    const isVolatilityStabilizing = bbWidth < prevBbWidth * 1.15;

    // Candle wicks for rejection checks
    const range = high - low || 1;
    const upperWick = high - Math.max(open, close);
    const lowerWick = Math.min(open, close) - low;
    const upperWickRatio = upperWick / range;
    const lowerWickRatio = lowerWick / range;

    const regime = RegimeEngine.getRegimeCategory(context);
    const isFavorableRegime = regime === "RANGING" || regime === "LIQUIDITY_SWEEP" || adx < 25;

    let direction: "LONG" | "SHORT" | "HOLD" = "HOLD";
    const reasoning: string[] = [];

    if (!isFavorableRegime) {
      reasoning.push(`Bollinger Reversion ignored: Strong trending or breakout environment (Regime: ${regime}, ADX: ${adx.toFixed(1)}).`);
      return { direction: "HOLD", reasoning, confidence: 0 };
    }

    // LONG Conditions
    const priceBelowBB = close < bbLower || low < bbLower * 1.001;
    const rsiOversold = rsi < 30;
    const isBullishRejection = (lowerWickRatio > 0.35 && close > bbLower) || (close > open && lowerWickRatio > 0.25);

    // SHORT Conditions
    const priceAboveBB = close > bbUpper || high > bbUpper * 0.999;
    const rsiOverbought = rsi > 70;
    const isBearishRejection = (upperWickRatio > 0.35 && close < bbUpper) || (close < open && upperWickRatio > 0.25);

    if (priceBelowBB && rsiOversold && isBullishRejection && isVolatilityStabilizing) {
      direction = "LONG";
      reasoning.push("Bollinger Reversion LONG Triggered.");
      reasoning.push(`Price wetted below lower band ($${bbLower.toFixed(2)}) with RSI oversold at ${rsi.toFixed(1)}.`);
      reasoning.push(`Bullish rejection wick of ${(lowerWickRatio * 100).toFixed(0)}% formed.`);
    } else if (priceAboveBB && rsiOverbought && isBearishRejection && isVolatilityStabilizing) {
      direction = "SHORT";
      reasoning.push("Bollinger Reversion SHORT Triggered.");
      reasoning.push(`Price pierced above upper band ($${bbUpper.toFixed(2)}) with RSI overbought at ${rsi.toFixed(1)}.`);
      reasoning.push(`Bearish rejection wick of ${(upperWickRatio * 100).toFixed(0)}% formed.`);
    } else {
      reasoning.push("No Bollinger bands exhaustion setups detected.");
    }

    let confidence = 0;
    if (direction !== "HOLD") {
      const rsiDevScore = direction === "LONG" ? Math.max(0, 30 - rsi) : Math.max(0, rsi - 70);
      const rsiScore = Math.min(30, Math.round(rsiDevScore * 3)); // Max 30 points
      const wickDominance = direction === "LONG" ? lowerWickRatio : upperWickRatio;
      const wickScore = Math.min(40, Math.round(wickDominance * 100)); // Max 40 points
      const volScore = isVolatilityStabilizing ? 30 : 10; // Max 30 points

      confidence = Math.min(100, Math.max(30, rsiScore + wickScore + volScore));
    }

    return { direction, reasoning, confidence };
  }

  public validate(context: StrategyContext): boolean {
    const { candles, indicators } = context;
    return (
      candles.length >= 20 &&
      indicators.bbUpper !== undefined &&
      indicators.bbMiddle !== undefined &&
      indicators.bbLower !== undefined &&
      indicators.adx !== undefined &&
      indicators.rsi !== undefined &&
      indicators.atr !== undefined &&
      indicators.bbUpper.length >= candles.length &&
      indicators.bbMiddle.length >= candles.length &&
      indicators.bbLower.length >= candles.length &&
      indicators.adx.length >= candles.length &&
      indicators.rsi.length >= candles.length &&
      indicators.atr.length >= candles.length
    );
  }

  public generateSignal(context: StrategyContext): StrategySignal {
    const { direction, reasoning, confidence } = this.analyze(context);
    const { candles, indicators, structure } = context;
    const lastIdx = candles.length - 1;
    const close = candles[lastIdx].close;
    const high = candles[lastIdx].high;
    const low = candles[lastIdx].low;
    const atr = indicators.atr[lastIdx] || (close * 0.015);

    let stopLoss = 0;
    let takeProfit = 0;

    // Swing point search or fallback
    const swingHighs = structure?.swings?.filter((s) => s.type === "HIGH" && s.index < lastIdx) || [];
    const swingLows = structure?.swings?.filter((s) => s.type === "LOW" && s.index < lastIdx) || [];
    const lastSwingHigh = swingHighs.length > 0 ? swingHighs[swingHighs.length - 1].price : high;
    const lastSwingLow = swingLows.length > 0 ? swingLows[swingLows.length - 1].price : low;

    const bbMiddle = indicators.bbMiddle[lastIdx] || close;

    if (direction === "LONG") {
      stopLoss = Math.min(low, lastSwingLow) - 0.2 * atr;
      if (stopLoss >= close) {
        stopLoss = close - 1.5 * atr;
      }
      // Target BB Middle or EMA20, ensure minimum 1:1.5 RR ratio
      takeProfit = bbMiddle;
      if (takeProfit <= close || (takeProfit - close) < 1.2 * (close - stopLoss)) {
        takeProfit = close + 1.5 * (close - stopLoss);
      }
    } else if (direction === "SHORT") {
      stopLoss = Math.max(high, lastSwingHigh) + 0.2 * atr;
      if (stopLoss <= close) {
        stopLoss = close + 1.5 * atr;
      }
      takeProfit = bbMiddle;
      if (takeProfit >= close || (close - takeProfit) < 1.2 * (stopLoss - close)) {
        takeProfit = close - 1.5 * (stopLoss - close);
      }
    }

    const bbUpper = indicators.bbUpper[lastIdx] || 0;
    const bbLower = indicators.bbLower[lastIdx] || 0;
    const bbWidth = bbMiddle > 0 ? (bbUpper - bbLower) / bbMiddle : 0;

    const regime = RegimeEngine.classify(context);
    const regimeCategory = RegimeEngine.getRegimeCategory(context);

    const marketContext = {
      regime,
      regimeCategory,
      volatilityState: {
        currentWidth: bbWidth,
        avgWidth: bbWidth, // cached indicators check
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
      }
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
