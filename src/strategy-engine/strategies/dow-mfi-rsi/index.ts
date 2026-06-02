import { TradingMode,  TradingStrategy, StrategyContext, StrategySignal } from "../../types";
import { SignalGenerator } from "../../core/signal-generator";
import { RegimeEngine } from "../../core/regime-engine";

export class DowFactorMFIRSIStrategy implements TradingStrategy {
  public id = "dow-mfi-rsi";
  public category: TradingMode = TradingMode.INTRADAY;
  public expectedHoldingTime = "1h-8h";
  public name = "Dow Factor MFI RSI Strategy";
  public description = "Trade momentum continuation in aligned Dow Theory structures validated by volume flow and RSI direction.";
  public type = "Momentum";
  public timeframe = "15m";
  public timeframes = ["5m", "15m"];
  public symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
  public enabled = true;
  public indicatorsRequired = ["rsi", "atr", "volumeMA", "mfi"];
  public supportedRegimes = ["Breakout","High Volatility","Bullish Trend","Bearish Trend"];

  public analyze(context: StrategyContext): { direction: "LONG" | "SHORT" | "HOLD"; reasoning: string[]; confidence: number } {
    const { candles, indicators, structure } = context;
    const lastIdx = candles.length - 1;
    const volume = candles[lastIdx].volume;

    const rsi = indicators.rsi[lastIdx];
    const prevRsi = lastIdx > 0 ? indicators.rsi[lastIdx - 1] : rsi;
    const volumeMA = indicators.volumeMA[lastIdx] || 1;
    
    const mfi = indicators.mfi?.[lastIdx] ?? 50;
    const prevMfi = lastIdx > 0 ? (indicators.mfi?.[lastIdx - 1] ?? 50) : mfi;

    const dowStructure = structure?.dowStructure || "RANGING";

    let direction: "LONG" | "SHORT" | "HOLD" = "HOLD";
    const reasoning: string[] = [];

    // LONG Conditions:
    // 1. dowStructure is BULLISH
    // 2. RSI > 50 and rising
    // 3. MFI > 50 and rising
    // 4. volume > volumeMA
    const isBullishStructure = dowStructure === "BULLISH";
    const rsiBullish = rsi > 50 && rsi > prevRsi;
    const mfiBullish = mfi > 50 && mfi > prevMfi;
    const volumeBullish = volume > volumeMA;

    // SHORT Conditions:
    // 1. dowStructure is BEARISH
    // 2. RSI < 50 and falling
    // 3. MFI < 50 and falling
    // 4. volume > volumeMA
    const isBearishStructure = dowStructure === "BEARISH";
    const rsiBearish = rsi < 50 && rsi < prevRsi;
    const mfiBearish = mfi < 50 && mfi < prevMfi;
    const volumeBearish = volume > volumeMA;

    if (isBullishStructure && rsiBullish && mfiBullish && volumeBullish) {
      direction = "LONG";
      reasoning.push("Dow Factor MFI RSI LONG Triggered.");
      reasoning.push(`Dow structure is BULLISH.`);
      reasoning.push(`RSI is above 50 and rising at ${rsi.toFixed(1)} (prev: ${prevRsi.toFixed(1)}).`);
      reasoning.push(`Money Flow Index is above 50 and rising at ${mfi.toFixed(1)} (prev: ${prevMfi.toFixed(1)}).`);
      reasoning.push(`Volume is above MA: ${volume.toFixed(0)} > ${volumeMA.toFixed(0)}.`);
    } else if (isBearishStructure && rsiBearish && mfiBearish && volumeBearish) {
      direction = "SHORT";
      reasoning.push("Dow Factor MFI RSI SHORT Triggered.");
      reasoning.push(`Dow structure is BEARISH.`);
      reasoning.push(`RSI is below 50 and falling at ${rsi.toFixed(1)} (prev: ${prevRsi.toFixed(1)}).`);
      reasoning.push(`Money Flow Index is below 50 and falling at ${mfi.toFixed(1)} (prev: ${prevMfi.toFixed(1)}).`);
      reasoning.push(`Volume is above MA: ${volume.toFixed(0)} > ${volumeMA.toFixed(0)}.`);
    } else {
      reasoning.push(`No Dow structure continuation signal. Dow structure: ${dowStructure}`);
    }

    let confidence = 0;
    if (direction !== "HOLD") {
      const volRatio = volumeMA > 0 ? volume / volumeMA : 1.0;
      const volScore = Math.min(30, Math.round((volRatio - 1.0) * 50)); // up to 30 points for volume spike
      
      const rsiDist = direction === "LONG" ? Math.max(0, rsi - 50) : Math.max(0, 50 - rsi);
      const rsiScore = Math.min(35, Math.round(rsiDist * 2)); // up to 35 points
      
      const mfiDist = direction === "LONG" ? Math.max(0, mfi - 50) : Math.max(0, 50 - mfi);
      const mfiScore = Math.min(35, Math.round(mfiDist * 2)); // up to 35 points

      confidence = Math.min(100, Math.max(30, rsiScore + mfiScore + volScore + 30));
    }

    return { direction, reasoning, confidence };
  }

  public validate(context: StrategyContext): boolean {
    const { candles, indicators } = context;
    return (
      candles.length >= 20 &&
      indicators.rsi !== undefined &&
      indicators.atr !== undefined &&
      indicators.volumeMA !== undefined &&
      indicators.mfi !== undefined &&
      indicators.rsi.length >= candles.length &&
      indicators.atr.length >= candles.length &&
      indicators.volumeMA.length >= candles.length &&
      indicators.mfi.length >= candles.length
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

    // Find recent swings for SL and TP
    const swingHighs = structure?.swings?.filter((s) => s.type === "HIGH" && s.index < lastIdx) || [];
    const swingLows = structure?.swings?.filter((s) => s.type === "LOW" && s.index < lastIdx) || [];
    const lastSwingHigh = swingHighs.length > 0 ? swingHighs[swingHighs.length - 1].price : high;
    const lastSwingLow = swingLows.length > 0 ? swingLows[swingLows.length - 1].price : low;

    if (direction === "LONG") {
      stopLoss = Math.min(low, lastSwingLow) - 0.2 * atr;
      if (stopLoss >= close) {
        stopLoss = close - 1.5 * atr;
      }
      // Target opposing swing high or dynamic ATR target
      takeProfit = lastSwingHigh;
      if (takeProfit <= close || (takeProfit - close) < 1.5 * (close - stopLoss)) {
        takeProfit = close + 2.5 * atr;
      }
      if (takeProfit <= close || (takeProfit - close) < 1.2 * (close - stopLoss)) {
        takeProfit = close + 1.5 * (close - stopLoss);
      }
    } else if (direction === "SHORT") {
      stopLoss = Math.max(high, lastSwingHigh) + 0.2 * atr;
      if (stopLoss <= close) {
        stopLoss = close + 1.5 * atr;
      }
      // Target opposing swing low or dynamic ATR target
      takeProfit = lastSwingLow;
      if (takeProfit >= close || (close - takeProfit) < 1.5 * (stopLoss - close)) {
        takeProfit = close - 2.5 * atr;
      }
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
      dowStructure: structure?.dowStructure,
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
