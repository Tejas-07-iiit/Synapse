import { StrategyContext, StrategySignal } from "../types";
import { RegimeEngine } from "./regime-engine";

const STRATEGY_NAMES: Record<string, string> = {
  "ema-crossover": "EMA Crossover Strategy",
  "rsi-reversal": "RSI Reversal Strategy",
  "macd-momentum": "MACD Momentum Strategy",
  "bollinger-breakout": "Bollinger Breakout Strategy",
  "mean-reversion": "Mean Reversion Strategy",
  "momentum": "Momentum Strategy",
  "defensive": "Defensive Strategy",
  "grid": "Grid Strategy",
  "lorentzian": "Lorentzian Classification",
  "donchian-breakout": "Donchian Breakout Strategy",
  "rally-base-drop": "Rally Base Drop Strategy",
  "sr-sweep": "Support Resistance Sweep Strategy",
  "bollinger-reversion": "Bollinger Reversion Strategy",
  "short-term-reversal": "Short Term Reversal Strategy",
  "dow-mfi-rsi": "Dow Factor MFI RSI Strategy",
  "parabolic-rsi": "Parabolic RSI Strategy",
  "range-breakout-high": "Range Breakout High Strategy",
  "residual-momentum": "Residual Momentum Strategy",
  "time-series-momentum": "Time Series Momentum Strategy",
  "wavetrend": "WaveTrend Oscillator Strategy",
  "hash-ribbons": "Hash Ribbons Strategy",
  "news-fear-greed": "News Fear & Greed Strategy",
  "ema-cross-adx": "EMA Cross ADX Strategy",
  "golden-cross": "Golden Cross Strategy",
  "heiken-ashi-swing": "Heiken Ashi Swing Strategy",
  "hyper-supertrend": "Hyper Supertrend Strategy",
  "ichimoku-cloud": "Ichimoku Cloud Strategy",
  "ma-crossover-var": "MA Crossover Variable",
  "sma-trend-filter": "SMA Trend Filter",
  "t3-nexus": "T3 Nexus",
  "squeeze-momentum": "Squeeze Momentum",
  "volatility-regime": "Volatility Regime",
  "zeiierman-volatility": "Zeiierman Volatility",
};

export class SignalGenerator {
  /**
   * Generates a standardized StrategySignal based on strategy evaluation output.
   */
  public static createSignal(
    strategyId: string,
    signal: "LONG" | "SHORT" | "HOLD",
    confidence: number,
    reasoning: string[],
    context: StrategyContext,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    marketContextOverride?: any
  ): StrategySignal {
    const { symbol, timeframe, candles, indicators } = context;
    const lastIdx = candles.length - 1;
    
    const entry = lastIdx >= 0 ? candles[lastIdx].close : 0;
    const open = lastIdx >= 0 ? candles[lastIdx].open : 0;
    const high = lastIdx >= 0 ? candles[lastIdx].high : 0;
    const low = lastIdx >= 0 ? candles[lastIdx].low : 0;
    const volume = lastIdx >= 0 ? candles[lastIdx].volume : 0;
    const timestamp = Date.now();
    const atr = (indicators && indicators.atr && lastIdx >= 0) 
      ? indicators.atr[lastIdx] 
      : (entry * 0.015); // Fallback: 1.5% of price

    // Dynamic SL/TP based on regime and volatility
    const bbUpper = indicators?.bbUpper?.[lastIdx] || 0;
    const bbLower = indicators?.bbLower?.[lastIdx] || 0;
    const bbMiddle = indicators?.bbMiddle?.[lastIdx] || 1;
    const bbWidth = bbMiddle > 0 ? (bbUpper - bbLower) / bbMiddle : 0.05;

    const classification = RegimeEngine.classify(context);

    let slMultiplier = 1.5;
    let tpMultiplier = 3.75; // 2.5x RR

    if (classification === "Low Volatility" || bbWidth < 0.02) {
      slMultiplier = 1.0;
      tpMultiplier = 2.0; // 2.0x RR
    } else if (classification === "High Volatility" || classification === "Breakout" || bbWidth > 0.08) {
      slMultiplier = 2.0;
      tpMultiplier = 6.0; // 3.0x RR
    }

    const slDistance = slMultiplier * atr;
    const tpDistance = tpMultiplier * atr;

    let stopLoss = 0;
    let takeProfit = 0;

    if (signal === "LONG" && entry > 0) {
      stopLoss = entry - slDistance;
      takeProfit = entry + tpDistance;
    } else if (signal === "SHORT" && entry > 0) {
      stopLoss = entry + slDistance;
      takeProfit = entry - tpDistance;
    }

    // Capture standard indicators values to attach to the signal contract
    const rsi = indicators?.rsi?.[lastIdx];
    const ema = indicators?.ema20?.[lastIdx];
    const sma = indicators?.sma50?.[lastIdx];
    const macd = indicators?.macdHist?.[lastIdx];

    // Capture new indicators
    const stochRsiK = indicators?.stochRsiK?.[lastIdx];
    const stochRsiD = indicators?.stochRsiD?.[lastIdx];
    const adx = indicators?.adx?.[lastIdx];
    const support = indicators?.supportLevels?.[lastIdx];
    const resistance = indicators?.resistanceLevels?.[lastIdx];

    // Calculate default market context if not provided
    let marketContext = marketContextOverride;
    if (!marketContext && lastIdx >= 0) {
      const regime = RegimeEngine.classify(context);
      const regimeCategory = RegimeEngine.getRegimeCategory(context);
      
      const prevBbUpper = lastIdx > 0 ? (indicators?.bbUpper?.[lastIdx - 1] || bbUpper) : bbUpper;
      const prevBbLower = lastIdx > 0 ? (indicators?.bbLower?.[lastIdx - 1] || bbLower) : bbLower;
      const prevBbMiddle = lastIdx > 0 ? (indicators?.bbMiddle?.[lastIdx - 1] || bbMiddle) : bbMiddle;
      const prevBbWidth = (prevBbUpper - prevBbLower) / (prevBbMiddle || 1);

      const isExpanding = bbWidth > prevBbWidth;

      const volumeMA = indicators?.volumeMA?.[lastIdx] || 1;
      const candleRange = high - low || 1;
      const bodyRatio = Math.abs(entry - open) / candleRange;
      const upperWick = high - Math.max(open, entry);
      const lowerWick = Math.min(open, entry) - low;

      marketContext = {
        regime,
        regimeCategory,
        volatilityState: {
          currentWidth: bbWidth,
          avgWidth: prevBbWidth,
          isExpanding,
          atr,
        },
        breakoutStrength: {
          bbWidth,
          prevBbWidth,
          bodyRatio,
          volumeRatio: volumeMA > 0 ? volume / volumeMA : 1,
          upperWickRatio: upperWick / candleRange,
          lowerWickRatio: lowerWick / candleRange,
        }
      };
    }

    const STRATEGY_CATEGORIES: Record<string, string> = {
      "ema-crossover": "Trend Following",
      "rsi-reversal": "Reversal",
      "macd-momentum": "Momentum",
      "bollinger-breakout": "Breakout",
      "mean-reversion": "Mean-Reversion",
      "momentum": "Momentum",
      "defensive": "Defensive",
      "grid": "Grid",
      "lorentzian": "Lorentzian",
      "donchian-breakout": "Breakout",
      "rally-base-drop": "SupplyDemand",
      "sr-sweep": "LiquiditySweep",
      "bollinger-reversion": "MeanReversion",
      "short-term-reversal": "Reversal",
      "dow-mfi-rsi": "Momentum",
      "parabolic-rsi": "Momentum",
      "range-breakout-high": "Breakout",
      "residual-momentum": "Momentum",
      "time-series-momentum": "Momentum",
      "wavetrend": "Momentum",
      "hash-ribbons": "Sentiment",
      "news-fear-greed": "Sentiment",
      "ema-cross-adx": "Trend Following",
      "golden-cross": "Trend Following",
      "heiken-ashi-swing": "Trend Following",
      "hyper-supertrend": "Trend Following",
      "ichimoku-cloud": "Trend Following",
      "ma-crossover-var": "Trend Following",
      "sma-trend-filter": "Trend Following",
      "t3-nexus": "Trend Following",
      "squeeze-momentum": "Volatility",
      "volatility-regime": "Volatility",
      "zeiierman-volatility": "Volatility",
    };

    // Consensus category classification for category-based consensus engine
    const CONSENSUS_CATEGORIES: Record<string, string> = {
      // Scalping (15 strategies)
      "ema-crossover": "SCALPING",
      "rsi-reversal": "SCALPING",
      "macd-momentum": "SCALPING",
      "bollinger-breakout": "SCALPING",
      "mean-reversion": "SCALPING",
      "momentum": "SCALPING",
      "grid": "SCALPING",
      "donchian-breakout": "SCALPING",
      "rally-base-drop": "SCALPING",
      "sr-sweep": "SCALPING",
      "bollinger-reversion": "SCALPING",
      "short-term-reversal": "SCALPING",
      "parabolic-rsi": "SCALPING",
      "range-breakout-high": "SCALPING",
      "residual-momentum": "SCALPING",
      // Intraday (11 strategies)
      "wavetrend": "INTRADAY",
      "dow-mfi-rsi": "INTRADAY",
      "lorentzian": "INTRADAY",
      "ema-cross-adx": "INTRADAY",
      "hyper-supertrend": "INTRADAY",
      "ma-crossover-var": "INTRADAY",
      "sma-trend-filter": "INTRADAY",
      "t3-nexus": "INTRADAY",
      "squeeze-momentum": "INTRADAY",
      "time-series-momentum": "INTRADAY",
      "volatility-regime": "INTRADAY",
      // Swing (5 strategies)
      "golden-cross": "SWING",
      "heiken-ashi-swing": "SWING",
      "ichimoku-cloud": "SWING",
      "hash-ribbons": "SWING",
      "news-fear-greed": "SWING",
      // Defensive (2 strategies)
      "defensive": "DEFENSIVE",
      "zeiierman-volatility": "DEFENSIVE",
    };

    const strategyName = STRATEGY_NAMES[strategyId] || "AI Confluence Strategy";
    const strategyCategory = STRATEGY_CATEGORIES[strategyId] || "Central Engine";
    const consensusCategory = CONSENSUS_CATEGORIES[strategyId] || "INTRADAY";

    // Enforce Minimum Risk-to-Reward Ratio of 1.5
    if (signal !== "HOLD" && stopLoss > 0 && takeProfit > 0) {
      const risk = Math.abs(entry - stopLoss);
      const reward = Math.abs(takeProfit - entry);
      if (risk > 0) {
        const rr = reward / risk;
        if (rr < 1.5) {
          if (signal === "LONG") {
            takeProfit = entry + risk * 1.5;
          } else {
            takeProfit = entry - risk * 1.5;
          }
          reasoning.push(`Take Profit adjusted to enforce minimum 1.5x Risk-to-Reward ratio.`);
        }
      }
    }

    return {
      strategyId,
      strategyName,
      strategyCategory,
      consensusCategory,
      signal,
      signalType: signal,
      confidence,
      entry,
      stopLoss: Number(stopLoss.toFixed(4)),
      takeProfit: Number(takeProfit.toFixed(4)),
      symbol,
      timeframe,
      timestamp,
      reasoning,
      indicators: {
        rsi,
        ema,
        sma,
        macd,
        atr,
        volume,
        stochRsiK,
        stochRsiD,
        adx,
        support,
        resistance,
      },
      marketContext,
    };
  }
}

