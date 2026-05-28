import { TradingStrategy, StrategyContext, StrategySignal } from "../../types";
import { SignalGenerator } from "../../core/signal-generator";
import { RegimeEngine } from "../../core/regime-engine";

export class SRSweepStrategy implements TradingStrategy {
  public id = "sr-sweep";
  public name = "Support Resistance Sweep Strategy";
  public description = "Detect stop-hunts and liquidity grabs sweeping 52-period highs/lows. Best in ranging and liquidity-hunt environments.";
  public type = "LiquiditySweep";
  public timeframe = "15m";
  public timeframes = ["5m", "15m"];
  public symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
  public enabled = true;
  public indicatorsRequired = ["rsi", "atr", "volumeMA"];

  public analyze(context: StrategyContext): { direction: "LONG" | "SHORT" | "HOLD"; reasoning: string[]; confidence: number; sweepPrice: number } {
    const { candles, indicators, structure } = context;
    const reasoning: string[] = [];

    if (!structure || !structure.sweeps || structure.sweeps.length === 0) {
      reasoning.push("No liquidity sweep indicators detected in market structure.");
      return { direction: "HOLD", reasoning, confidence: 0, sweepPrice: 0 };
    }

    const lastIdx = candles.length - 1;
    const close = candles[lastIdx].close;
    const open = candles[lastIdx].open;
    const high = candles[lastIdx].high;
    const low = candles[lastIdx].low;
    const volume = candles[lastIdx].volume;
    const volumeMA = indicators.volumeMA?.[lastIdx] || 1;
    const rsi = indicators.rsi?.[lastIdx] || 50;

    const currentSweep = structure.sweeps[lastIdx];
    if (!currentSweep) {
      reasoning.push("No sweep indicators found for current candle.");
      return { direction: "HOLD", reasoning, confidence: 0, sweepPrice: 0 };
    }

    const range = high - low || 1;
    const upperWick = high - Math.max(open, close);
    const lowerWick = Math.min(open, close) - low;
    const upperWickRatio = upperWick / range;
    const lowerWickRatio = lowerWick / range;

    const regime = RegimeEngine.getRegimeCategory(context);
    const isRangingOrSweep = regime === "RANGING" || regime === "LIQUIDITY_SWEEP" || regime === "ACCUMULATION" || regime === "DISTRIBUTION";

    let direction: "LONG" | "SHORT" | "HOLD" = "HOLD";
    let sweepPrice = 0;

    // Check LONG Sweep (sweeping 52-period low)
    if (currentSweep.lowSwept && isRangingOrSweep) {
      direction = "LONG";
      sweepPrice = currentSweep.lowSweptPrice;
      reasoning.push("Liquidity sweep of 52-period Support Low detected.");
      reasoning.push(`Price swept below support line ($${sweepPrice.toFixed(2)}) and rejected, closing back inside at $${close.toFixed(2)}.`);
      reasoning.push(`RSI is oversold at ${rsi.toFixed(1)} with a dominant lower wick of ${(lowerWickRatio * 100).toFixed(0)}%.`);
    }
    
    // Check SHORT Sweep (sweeping 52-period high)
    else if (currentSweep.highSwept && isRangingOrSweep) {
      direction = "SHORT";
      sweepPrice = currentSweep.highSweptPrice;
      reasoning.push("Liquidity sweep of 52-period Resistance High detected.");
      reasoning.push(`Price swept above resistance line ($${sweepPrice.toFixed(2)}) and rejected, closing back inside at $${close.toFixed(2)}.`);
      reasoning.push(`RSI is overbought at ${rsi.toFixed(1)} with a dominant upper wick of ${(upperWickRatio * 100).toFixed(0)}%.`);
    }

    if (direction === "HOLD") {
      reasoning.push("No liquidity sweep indicators triggered on current close.");
      return { direction: "HOLD", reasoning, confidence: 0, sweepPrice: 0 };
    }

    // Confidence Calculation
    const wickDominance = direction === "LONG" ? lowerWickRatio : upperWickRatio;
    const wickScore = Math.round(wickDominance * 50); // up to 50
    const rsiScore = Math.round(Math.abs(rsi - 50) * 1.5); // up to 30
    const volumeScore = volume > volumeMA * 1.4 ? 20 : 10; // up to 20

    let confidence = wickScore + rsiScore + volumeScore;
    confidence = Math.min(100, Math.max(30, confidence));

    return { direction, reasoning, confidence, sweepPrice };
  }

  public validate(context: StrategyContext): boolean {
    const { candles, indicators, structure } = context;
    return (
      candles.length >= 53 && // Need at least 53 candles to form 52 range high/low
      indicators.rsi !== undefined &&
      indicators.atr !== undefined &&
      indicators.volumeMA !== undefined &&
      structure !== undefined &&
      structure.sweeps !== undefined &&
      indicators.rsi.length >= candles.length &&
      indicators.atr.length >= candles.length &&
      indicators.volumeMA.length >= candles.length
    );
  }

  public generateSignal(context: StrategyContext): StrategySignal {
    const { direction, reasoning, confidence, sweepPrice } = this.analyze(context);
    const { candles, indicators } = context;
    const lastIdx = candles.length - 1;
    const close = candles[lastIdx].close;
    const high = candles[lastIdx].high;
    const low = candles[lastIdx].low;
    const atr = indicators.atr[lastIdx] || (close * 0.015);

    let stopLoss = 0;
    let takeProfit = 0;

    // Retrieve prior 52 candles to find range midpoint
    const prev52Highs = candles.slice(lastIdx - 52, lastIdx).map((c) => c.high);
    const prev52Lows = candles.slice(lastIdx - 52, lastIdx).map((c) => c.low);
    const rangeHigh = Math.max(...prev52Highs);
    const rangeLow = Math.min(...prev52Lows);
    const rangeMidpoint = (rangeHigh + rangeLow) / 2;

    if (direction === "LONG") {
      stopLoss = low - 0.2 * atr; // SL below sweep low
      if (stopLoss >= close) {
        stopLoss = close - 1.5 * atr;
      }
      takeProfit = rangeMidpoint; // Target range middle
    } else if (direction === "SHORT") {
      stopLoss = high + 0.2 * atr; // SL above sweep high
      if (stopLoss <= close) {
        stopLoss = close + 1.5 * atr;
      }
      takeProfit = rangeMidpoint; // Target range middle
    }

    const bbUpper = indicators.bbUpper?.[lastIdx] || 0;
    const bbMiddle = indicators.bbMiddle?.[lastIdx] || 1;
    const bbLower = indicators.bbLower?.[lastIdx] || 0;
    const bbWidth = (bbUpper - bbLower) / bbMiddle;

    const prevBbUpper = lastIdx > 0 ? (indicators.bbUpper?.[lastIdx - 1] || bbUpper) : bbUpper;
    const prevBbLower = lastIdx > 0 ? (indicators.bbLower?.[lastIdx - 1] || bbLower) : bbLower;
    const prevBbMiddle = lastIdx > 0 ? (indicators.bbMiddle?.[lastIdx - 1] || bbMiddle) : bbMiddle;
    const prevBbWidth = (prevBbUpper - prevBbLower) / (prevBbMiddle || 1);

    const regime = RegimeEngine.classify(context);
    const regimeCategory = RegimeEngine.getRegimeCategory(context);

    const marketContext = {
      regime,
      regimeCategory,
      volatilityState: {
        currentWidth: bbWidth,
        avgWidth: prevBbWidth,
        isExpanding: bbWidth > prevBbWidth,
        atr,
      },
      breakoutStrength: {
        bbWidth,
        prevBbWidth,
        bodyRatio: Math.abs(close - candles[lastIdx].open) / (high - low || 1),
        volumeRatio: indicators.volumeMA?.[lastIdx] ? candles[lastIdx].volume / indicators.volumeMA[lastIdx] : 1,
        upperWickRatio: (high - Math.max(candles[lastIdx].open, close)) / (high - low || 1),
        lowerWickRatio: (Math.min(candles[lastIdx].open, close) - low) / (high - low || 1),
      },
      sweepMetadata: {
        sweepPrice,
        rangeHigh,
        rangeLow,
        rangeMidpoint,
        rsi: indicators.rsi?.[lastIdx]
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

    // Override SL/TP
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
