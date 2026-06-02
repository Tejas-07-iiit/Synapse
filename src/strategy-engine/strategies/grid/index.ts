import { TradingMode,  TradingStrategy, StrategyContext, StrategySignal } from "../../types";
import { SignalGenerator } from "../../core/signal-generator";
import { RegimeEngine } from "../../core/regime-engine";

export class GridStrategy implements TradingStrategy {
  public id = "grid";
  public category: TradingMode = TradingMode.SCALPING;
  public expectedHoldingTime = "5m-45m";
  public name = "Grid Strategy";
  public description = "Trade oscillations inside structured market ranges. Best in ranging, sideways markets.";
  public type = "Grid";
  public timeframe = "15m";
  public timeframes = ["5m", "15m"];
  public symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
  public enabled = true;
  public indicatorsRequired = ["rsi", "atr", "ema20", "sma50", "macdHist", "adx"];
  public supportedRegimes = ["Ranging","Accumulation","Distribution","Low Volatility"];

  public analyze(context: StrategyContext): { direction: "LONG" | "SHORT" | "HOLD"; reasoning: string[]; confidence: number } {
    const { candles, indicators } = context;
    const lastIdx = candles.length - 1;
    const close = candles[lastIdx].close;
    const high = candles[lastIdx].high;
    const low = candles[lastIdx].low;
    const rsiLast = indicators.rsi[lastIdx];
    const ema20Last = indicators.ema20[lastIdx];
    const sma50Last = indicators.sma50[lastIdx];
    const macdHist = indicators.macdHist[lastIdx];
    const prevMacdHist = lastIdx > 0 ? indicators.macdHist[lastIdx - 1] : 0;
    const adxLast = indicators.adx[lastIdx];

    let direction: "LONG" | "SHORT" | "HOLD" = "HOLD";
    const reasoning: string[] = [];

    const last15 = candles.slice(-15);
    const support = Math.min(...last15.map((c) => c.low));
    const resistance = Math.max(...last15.map((c) => c.high));
    const rangeWidth = (resistance - support) / close;

    // Volatility Filter and Trend Filter (ADX)
    const regime = RegimeEngine.getRegimeCategory(context);
    const isTrending = adxLast > 25 || regime === "TRENDING";

    if (isTrending) {
      reasoning.push(`Grid Strategy ignored: Strong trend detected (ADX = ${adxLast.toFixed(1)}, regime = ${regime}).`);
      return { direction: "HOLD", reasoning, confidence: 0 };
    }

    if (regime !== "RANGING") {
      reasoning.push(`Grid Strategy ignored: Market is not in RANGING regime (regime = ${regime}).`);
      return { direction: "HOLD", reasoning, confidence: 0 };
    }

    // Grid Strategy Core Logic:
    // LONG Conditions:
    // 1. Price near lower range/support (close <= support * 1.015)
    // 2. RSI14 < 35
    // 3. MACD momentum stabilizing (macdHist >= prevMacdHist)
    // 4. EMA20 ≈ EMA50 (difference < 0.5% of SMA50)
    // 5. Volatility moderate (rangeWidth <= 0.04 && rangeWidth >= 0.005)
    // 6. Price rejection from support (low tested support and close > support)
    const nearSupport = close <= support * 1.015;
    const isRsiLong = rsiLast < 35;
    const macdStabilizing = macdHist >= prevMacdHist;
    const emaFlat = Math.abs(ema20Last - sma50Last) / sma50Last < 0.005;
    const volatilityModerate = rangeWidth <= 0.04 && rangeWidth >= 0.005;
    const rejectionSupport = low <= support * 1.002 && close > support;

    // SHORT Conditions:
    // 1. Price near upper range/resistance (close >= resistance * 0.985)
    // 2. RSI14 > 65
    // 3. MACD weakening (macdHist <= prevMacdHist)
    // 4. EMA20 ≈ EMA50 (difference < 0.5%)
    // 5. Volatility moderate
    // 6. Rejection from resistance (high tested resistance and close < resistance)
    const nearResistance = close >= resistance * 0.985;
    const isRsiShort = rsiLast > 65;
    const macdWeakening = macdHist <= prevMacdHist;
    const rejectionResistance = high >= resistance * 0.998 && close < resistance;

    if (nearSupport && isRsiLong && macdStabilizing && emaFlat && volatilityModerate && rejectionSupport) {
      direction = "LONG";
      reasoning.push("Grid LONG Entry triggered at range bottom.");
      reasoning.push(`Price sits near support $${support.toFixed(2)}. RSI is ${rsiLast.toFixed(1)}.`);
      reasoning.push(`EMA20 and EMA50 are flat (diff = ${(Math.abs(ema20Last - sma50Last) / sma50Last * 100).toFixed(2)}%), confirming sideways range.`);
    } else if (nearResistance && isRsiShort && macdWeakening && emaFlat && volatilityModerate && rejectionResistance) {
      direction = "SHORT";
      reasoning.push("Grid SHORT Entry triggered at range top.");
      reasoning.push(`Price sits near resistance $${resistance.toFixed(2)}. RSI is ${rsiLast.toFixed(1)}.`);
      reasoning.push(`EMA20 and EMA50 are flat, confirming sideways range.`);
    } else {
      reasoning.push("No grid range-bound opportunity detected.");
    }

    // Confidence scoring
    let confidence = 0;
    if (direction !== "HOLD") {
      const trendScore = emaFlat ? 20 : 5;
      const rsiScore = direction === "LONG" ? (rsiLast < 30 ? 20 : 15) : (rsiLast > 70 ? 20 : 15);
      const macdScore = 20;
      const volatilityScore = rangeWidth <= 0.025 ? 20 : 15;
      
      const distToBoundary = direction === "LONG" ? (close - support) / close : (resistance - close) / close;
      const srProximityScore = distToBoundary <= 0.005 ? 20 : 10;

      confidence = trendScore + rsiScore + macdScore + volatilityScore + srProximityScore;
    }

    return { direction, reasoning, confidence };
  }

  public validate(context: StrategyContext): boolean {
    const { candles, indicators } = context;
    return (
      candles.length >= 15 &&
      indicators.rsi !== undefined &&
      indicators.rsi.length >= candles.length &&
      indicators.ema20 !== undefined &&
      indicators.ema20.length >= candles.length &&
      indicators.sma50 !== undefined &&
      indicators.sma50.length >= candles.length &&
      indicators.macdHist !== undefined &&
      indicators.macdHist.length >= candles.length &&
      indicators.adx !== undefined &&
      indicators.adx.length >= candles.length &&
      indicators.atr !== undefined &&
      indicators.atr.length >= candles.length
    );
  }

  public generateSignal(context: StrategyContext): StrategySignal {
    const { direction, reasoning, confidence } = this.analyze(context);
    const { candles, indicators } = context;
    const lastIdx = candles.length - 1;
    const close = candles[lastIdx].close;
    const open = candles[lastIdx].open;
    const high = candles[lastIdx].high;
    const low = candles[lastIdx].low;
    const atr = indicators.atr[lastIdx] || (close * 0.015);

    const last15 = candles.slice(-15);
    const support = Math.min(...last15.map((c) => c.low));
    const resistance = Math.max(...last15.map((c) => c.high));
    const midpoint = (support + resistance) / 2;
    const rangeWidth = (resistance - support) / close;

    let stopLoss = 0;
    let takeProfit = 0;

    if (direction === "LONG") {
      stopLoss = support - 1.0 * atr;
      if (stopLoss >= close) {
        stopLoss = close - 1.5 * atr;
      }
      takeProfit = midpoint; // Target midpoint
    } else if (direction === "SHORT") {
      stopLoss = resistance + 1.0 * atr;
      if (stopLoss <= close) {
        stopLoss = close + 1.5 * atr;
      }
      takeProfit = midpoint; // Target midpoint
    }

    const regime = RegimeEngine.classify(context);
    const regimeCategory = RegimeEngine.getRegimeCategory(context);
    const candleRange = high - low || 1;
    const bodyRatio = Math.abs(close - open) / candleRange;
    const upperWick = high - Math.max(open, close);
    const lowerWick = Math.min(open, close) - low;

    const marketContext = {
      regime,
      regimeCategory,
      volatilityState: {
        currentWidth: rangeWidth,
        avgWidth: rangeWidth,
        isExpanding: false,
        atr,
      },
      breakoutStrength: {
        bbWidth: rangeWidth,
        prevBbWidth: rangeWidth,
        bodyRatio,
        volumeRatio: 1.0,
        upperWickRatio: upperWick / candleRange,
        lowerWickRatio: lowerWick / candleRange,
      },
      support,
      resistance,
      midpoint,
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
