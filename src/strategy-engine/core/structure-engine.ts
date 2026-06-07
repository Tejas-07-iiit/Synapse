import { Candle, IndicatorValues, MarketStructureData, SwingPoint, SupplyDemandZone } from "../types";

export class StructureEngine {
  private static cache = new Map<string, { lastTime: number; data: MarketStructureData }>();

  /**
   * Main entry point to compute market structure data once per candle close.
   */
  public static calculate(
    symbol: string,
    timeframe: string,
    candles: Candle[],
    indicators: IndicatorValues
  ): MarketStructureData {
    if (candles.length === 0) {
      return this.createEmptyStructure();
    }

    const key = `${symbol.toUpperCase()}_${timeframe.toLowerCase()}`;
    const lastCandle = candles[candles.length - 1];
    const cached = this.cache.get(key);

    // If cached data is present and corresponds to the same last candle time, return it
    if (cached && cached.lastTime === lastCandle.time) {
      return cached.data;
    }

    const data = this.computeStructure(candles, indicators);
    this.cache.set(key, { lastTime: lastCandle.time, data });
    return data;
  }

  private static createEmptyStructure(): MarketStructureData {
    return {
      donchian: { upper: [], lower: [], middle: [] },
      swings: [],
      zones: [],
      sweeps: [],
      dowStructure: "RANGING",
    };
  }

  private static computeStructure(candles: Candle[], indicators: IndicatorValues): MarketStructureData {
    const len = candles.length;
    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);
    const closes = candles.map((c) => c.close);
    const opens = candles.map((c) => c.open);
    const volumes = candles.map((c) => c.volume);

    // 1. Calculate Donchian Channels (20)
    const donchianUpper: number[] = new Array(len).fill(0);
    const donchianLower: number[] = new Array(len).fill(0);
    const donchianMiddle: number[] = new Array(len).fill(0);

    for (let i = 0; i < len; i++) {
      if (i < 19) {
        donchianUpper[i] = highs[i];
        donchianLower[i] = lows[i];
        donchianMiddle[i] = (highs[i] + lows[i]) / 2;
      } else {
        const windowHighs = highs.slice(i - 19, i + 1); // 20-period
        const windowLows = lows.slice(i - 19, i + 1);
        donchianUpper[i] = Math.max(...windowHighs);
        donchianLower[i] = Math.min(...windowLows);
        donchianMiddle[i] = (donchianUpper[i] + donchianLower[i]) / 2;
      }
    }

    // 2. Detect Swing Points (left: 5, right: 2)
    const swings: SwingPoint[] = [];
    const leftW = 5;
    const rightW = 2;

    for (let i = leftW; i < len - rightW; i++) {
      const currentHigh = highs[i];
      const currentLow = lows[i];

      let isSwingHigh = true;
      let isSwingLow = true;

      // Check left side
      for (let j = 1; j <= leftW; j++) {
        if (highs[i - j] > currentHigh) isSwingHigh = false;
        if (lows[i - j] < currentLow) isSwingLow = false;
      }

      // Check right side
      for (let j = 1; j <= rightW; j++) {
        if (highs[i + j] > currentHigh) isSwingHigh = false;
        if (lows[i + j] < currentLow) isSwingLow = false;
      }

      if (isSwingHigh) {
        swings.push({
          index: i,
          price: currentHigh,
          type: "HIGH",
          timestamp: candles[i].time,
        });
      }
      if (isSwingLow) {
        swings.push({
          index: i,
          price: currentLow,
          type: "LOW",
          timestamp: candles[i].time,
        });
      }
    }

    // 3. Extract Supply & Demand Zones (consistently scoring and checking mitigation)
    const zones: SupplyDemandZone[] = [];
    const atr = indicators.atr || closes.map((c) => c * 0.015);
    const volumeMA = indicators.volumeMA || new Array(len).fill(1);

    // Look for explosive departures to mark zones
    for (let i = 20; i < len; i++) {
      const bodySize = Math.abs(closes[i] - opens[i]);
      const currentAtr = atr[i] || (closes[i] * 0.015);
      const isExplosive = bodySize > 1.8 * currentAtr && volumes[i] > volumeMA[i] * 1.2;

      if (isExplosive) {
        const isUp = closes[i] > opens[i];
        
        // Base consolidation area: 4 candles prior to breakout
        const baseStart = i - 4;
        const baseHigh = Math.max(...highs.slice(baseStart, i));
        const baseLow = Math.min(...lows.slice(baseStart, i));

        // Filter: Make sure base is a consolidation (body size not too large)
        const baseBodies = candles.slice(baseStart, i).map((c) => Math.abs(c.close - c.open));
        const avgBaseBody = baseBodies.reduce((sum, b) => sum + b, 0) / 4;
        if (avgBaseBody > 1.3 * currentAtr) {
          continue; // too volatile to be institutional base
        }

        // Track zone mitigation and reaction history from i + 1 to current
        let freshness = true;
        let reactionCount = 0;

        for (let k = i + 1; k < len; k++) {
          if (isUp) {
            // Demand zone mitigation check: Close below baseLow
            if (closes[k] < baseLow) {
              freshness = false;
              break;
            }
            // Touch reaction: Low touches baseHigh/baseLow but closes above
            if (lows[k] <= baseHigh && closes[k] > baseLow) {
              reactionCount++;
            }
          } else {
            // Supply zone mitigation check: Close above baseHigh
            if (closes[k] > baseHigh) {
              freshness = false;
              break;
            }
            // Touch reaction: High touches baseLow/baseHigh but closes below
            if (highs[k] >= baseLow && closes[k] < baseHigh) {
              reactionCount++;
            }
          }
        }

        // Calculate departure strength (ROI % of the explosive candle)
        const departureStrength = (bodySize / opens[i]) * 100;

        zones.push({
          id: `zone-${i}-${isUp ? "demand" : "supply"}`,
          type: isUp ? "DEMAND" : "SUPPLY",
          high: baseHigh,
          low: baseLow,
          volumeSpike: volumes[i] > volumeMA[i] * 1.5,
          departureStrength,
          freshness,
          reactionCount,
          createdAtIndex: i,
          createdAtTime: candles[i].time,
        });
      }
    }

    // 4. Track Range High/Low 52 Liquidity Sweeps
    const sweeps: {
      time: number;
      highSwept: boolean;
      lowSwept: boolean;
      highSweptPrice: number;
      lowSweptPrice: number;
    }[] = new Array(len).fill(null).map((_, idx) => ({
      time: candles[idx].time,
      highSwept: false,
      lowSwept: false,
      highSweptPrice: 0,
      lowSweptPrice: 0,
    }));

    const rsi = indicators.rsi || new Array(len).fill(50);

    for (let i = 52; i < len; i++) {
      const prev52Highs = highs.slice(i - 52, i);
      const prev52Lows = lows.slice(i - 52, i);
      const rangeHigh = Math.max(...prev52Highs);
      const rangeLow = Math.min(...prev52Lows);

      const currentCandle = candles[i];
      const candleRange = currentHighLowRange(currentCandle);

      // LOW SWEEP: Price goes below 52-period low, wicks back up, RSI is oversold, closes inside range
      const lowBreached = currentCandle.low < rangeLow;
      const closedInsideLow = currentCandle.close > rangeLow;
      const isOversold = rsi[i] < 35;
      const lowerWick = Math.min(currentCandle.open, currentCandle.close) - currentCandle.low;
      const lowWickDominant = lowerWick / candleRange > 0.4;

      if (lowBreached && closedInsideLow && isOversold && lowWickDominant) {
        sweeps[i].lowSwept = true;
        sweeps[i].lowSweptPrice = rangeLow;
      }

      // HIGH SWEEP: Price goes above 52-period high, wicks back down, RSI is overbought, closes inside range
      const highBreached = currentCandle.high > rangeHigh;
      const closedInsideHigh = currentCandle.close < rangeHigh;
      const isOverbought = rsi[i] > 65;
      const upperWick = currentCandle.high - Math.max(currentCandle.open, currentCandle.close);
      const highWickDominant = upperWick / candleRange > 0.4;

      if (highBreached && closedInsideHigh && isOverbought && highWickDominant) {
        sweeps[i].highSwept = true;
        sweeps[i].highSweptPrice = rangeHigh;
      }
    }

    // Classify Dow Theory trend structure
    let dowStructure: "BULLISH" | "BEARISH" | "RANGING" = "RANGING";
    const swingHighs = swings.filter((s) => s.type === "HIGH");
    const swingLows = swings.filter((s) => s.type === "LOW");

    if (swingHighs.length >= 2 && swingLows.length >= 2) {
      const lastHigh = swingHighs[swingHighs.length - 1];
      const prevHigh = swingHighs[swingHighs.length - 2];
      const lastLow = swingLows[swingLows.length - 1];
      const prevLow = swingLows[swingLows.length - 2];

      const isHigherHigh = lastHigh.price > prevHigh.price;
      const isHigherLow = lastLow.price > prevLow.price;
      const isLowerHigh = lastHigh.price < prevHigh.price;
      const isLowerLow = lastLow.price < prevLow.price;

      const lastClose = closes[len - 1];
      const ema20Val = indicators.ema20?.[len - 1] || lastClose;

      if (isHigherHigh && (isHigherLow || lastClose > ema20Val)) {
        dowStructure = "BULLISH";
      } else if (isLowerLow && (isLowerHigh || lastClose < ema20Val)) {
        dowStructure = "BEARISH";
      }
    }

    return {
      donchian: {
        upper: donchianUpper,
        lower: donchianLower,
        middle: donchianMiddle,
      },
      swings,
      zones,
      sweeps,
      dowStructure,
    };
  }
}

function currentHighLowRange(c: Candle): number {
  return c.high - c.low || 1;
}
