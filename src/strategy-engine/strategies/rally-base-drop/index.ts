import { TradingMode, ConsensusCategory, TradingStrategy, StrategyContext, StrategySignal, SupplyDemandZone } from "../../types";
import { SignalGenerator } from "../../core/signal-generator";
import { RegimeEngine } from "../../core/regime-engine";

export class RallyBaseDropStrategy implements TradingStrategy {
  public id = "rally-base-drop";
  public category: TradingMode = TradingMode.SCALPING;
  public consensusCategory: ConsensusCategory = ConsensusCategory.SCALPING;
  public expectedHoldingTime = "5m-45m";
  public name = "Rally Base Drop Strategy";
  public description = "Trade institutional supply/demand zone reactions (Rally-Base-Drop and Drop-Base-Rally patterns).";
  public type = "SupplyDemand";
  public timeframe = "1m";
  public timeframes = ["1m", "3m", "5m"];
  public symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
  public enabled = true;
  public indicatorsRequired = ["atr", "volumeMA"];
  public supportedRegimes = ["Ranging","Accumulation","Distribution","Low Volatility","Breakout","High Volatility"];

  public analyze(context: StrategyContext): { direction: "LONG" | "SHORT" | "HOLD"; reasoning: string[]; confidence: number; zone?: SupplyDemandZone } {
    const { candles, structure } = context;
    const reasoning: string[] = [];

    if (!structure || !structure.zones || structure.zones.length === 0) {
      reasoning.push("No supply/demand zones detected in market structure.");
      return { direction: "HOLD", reasoning, confidence: 0 };
    }

    const lastIdx = candles.length - 1;
    const close = candles[lastIdx].close;
    const open = candles[lastIdx].open;
    const high = candles[lastIdx].high;
    const low = candles[lastIdx].low;

    // Candle characteristics
    const range = high - low || 1;
    const upperWick = high - Math.max(open, close);
    const lowerWick = Math.min(open, close) - low;
    const upperWickRatio = upperWick / range;
    const lowerWickRatio = lowerWick / range;

    const regime = RegimeEngine.getRegimeCategory(context);
    const isAccumulationOrDistribution = regime === "ACCUMULATION" || regime === "DISTRIBUTION" || regime === "RANGING";

    // 1. Filter fresh zones
    const freshZones = structure.zones.filter((z) => z.freshness && z.createdAtIndex < lastIdx);

    let bestZone: SupplyDemandZone | undefined;
    let direction: "LONG" | "SHORT" | "HOLD" = "HOLD";

    // Check DEMAND zones (for LONG)
    // Touch: low is inside the zone (low <= zone.high and low >= zone.low * 0.998)
    // Rejection: closes above zone.high, forms lower wick
    const demandTouch = freshZones.find(
      (z) => z.type === "DEMAND" && low <= z.high && low >= z.low * 0.998 && close > z.high
    );

    if (demandTouch && lowerWickRatio >= 0.35 && close > open && isAccumulationOrDistribution) {
      direction = "LONG";
      bestZone = demandTouch;
      reasoning.push("Rally Base Drop - Bullish zone reaction detected.");
      reasoning.push(`Price touched demand zone ($${demandTouch.low.toFixed(2)} - $${demandTouch.high.toFixed(2)}) and rejected to close at $${close.toFixed(2)}.`);
      reasoning.push(`Strong lower wick (${(lowerWickRatio * 100).toFixed(0)}%) confirms buying absorption.`);
    }

    // Check SUPPLY zones (for SHORT)
    // Touch: high is inside the zone (high >= zone.low and high <= zone.high * 1.002)
    // Rejection: closes below zone.low, forms upper wick
    const supplyTouch = freshZones.find(
      (z) => z.type === "SUPPLY" && high >= z.low && high <= z.high * 1.002 && close < z.low
    );

    if (supplyTouch && upperWickRatio >= 0.35 && close < open && isAccumulationOrDistribution) {
      direction = "SHORT";
      bestZone = supplyTouch;
      reasoning.push("Rally Base Drop - Bearish zone reaction detected.");
      reasoning.push(`Price touched supply zone ($${supplyTouch.low.toFixed(2)} - $${supplyTouch.high.toFixed(2)}) and rejected to close at $${close.toFixed(2)}.`);
      reasoning.push(`Strong upper wick (${(upperWickRatio * 100).toFixed(0)}%) confirms selling pressure.`);
    }

    if (direction === "HOLD") {
      reasoning.push("No fresh supply/demand zone reactions matching reversal criteria.");
      return { direction: "HOLD", reasoning, confidence: 0 };
    }

    // Zone Quality Scoring (0 to 100)
    let confidence = 0;
    if (bestZone) {
      const departureScore = Math.min(25, Math.round(bestZone.departureStrength * 10)); // Up to 25
      const volumeScore = bestZone.volumeSpike ? 25 : 10; // Up to 25
      const mitigationScore = bestZone.reactionCount === 0 ? 25 : (bestZone.reactionCount <= 2 ? 15 : 5); // Freshness factor: 0 is best
      const rejectionWickScore = Math.min(25, Math.round((direction === "LONG" ? lowerWickRatio : upperWickRatio) * 45)); // Wick size

      confidence = departureScore + volumeScore + mitigationScore + rejectionWickScore;
      confidence = Math.min(100, Math.max(30, confidence));
    }

    return { direction, reasoning, confidence, zone: bestZone };
  }

  public validate(context: StrategyContext): boolean {
    const { candles, indicators, structure } = context;
    return (
      candles.length >= 20 &&
      indicators.atr !== undefined &&
      indicators.volumeMA !== undefined &&
      structure !== undefined &&
      structure.zones !== undefined &&
      indicators.atr.length >= candles.length &&
      indicators.volumeMA.length >= candles.length
    );
  }

  public generateSignal(context: StrategyContext): StrategySignal {
    const { direction, reasoning, confidence, zone } = this.analyze(context);
    const { candles, indicators, structure } = context;
    const lastIdx = candles.length - 1;
    const close = candles[lastIdx].close;
    const atr = indicators.atr[lastIdx] || (close * 0.015);

    let stopLoss = 0;
    let takeProfit = 0;

    if (direction === "LONG" && zone) {
      stopLoss = zone.low - 0.5 * atr; // SL below zone bottom
      if (stopLoss >= close) {
        stopLoss = close - 1.5 * atr;
      }
      
      // Target nearest opposing supply zone if present, otherwise default ATR
      const opposingSupply = structure?.zones.find(
        (z) => z.type === "SUPPLY" && z.freshness && z.low > close
      );
      takeProfit = opposingSupply ? opposingSupply.low : (close + 2.5 * atr);
    } else if (direction === "SHORT" && zone) {
      stopLoss = zone.high + 0.5 * atr; // SL above zone top
      if (stopLoss <= close) {
        stopLoss = close + 1.5 * atr;
      }
      
      // Target nearest opposing demand zone if present, otherwise default ATR
      const opposingDemand = structure?.zones.find(
        (z) => z.type === "DEMAND" && z.freshness && z.high < close
      );
      takeProfit = opposingDemand ? opposingDemand.high : (close - 2.5 * atr);
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
        bodyRatio: Math.abs(close - candles[lastIdx].open) / (candles[lastIdx].high - candles[lastIdx].low || 1),
        volumeRatio: indicators.volumeMA?.[lastIdx] ? candles[lastIdx].volume / indicators.volumeMA[lastIdx] : 1,
        upperWickRatio: (candles[lastIdx].high - Math.max(candles[lastIdx].open, close)) / (candles[lastIdx].high - candles[lastIdx].low || 1),
        lowerWickRatio: (Math.min(candles[lastIdx].open, close) - candles[lastIdx].low) / (candles[lastIdx].high - candles[lastIdx].low || 1),
      },
      zoneData: zone ? {
        id: zone.id,
        type: zone.type,
        high: zone.high,
        low: zone.low,
        freshness: zone.freshness,
        reactionCount: zone.reactionCount,
        departureStrength: zone.departureStrength
      } : undefined
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
