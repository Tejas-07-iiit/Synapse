import { TradingMode, ConsensusCategory, TradingStrategy, StrategyContext, StrategySignal } from "../../types";
import { SignalGenerator } from "../../core/signal-generator";

export class HyperSupertrendStrategy implements TradingStrategy {
  public id = "hyper-supertrend";
  public category: TradingMode = TradingMode.INTRADAY;
  public consensusCategory: ConsensusCategory = ConsensusCategory.INTRADAY;
  public expectedHoldingTime = "1h-8h";
  public name = "Hyper Supertrend Strategy";
  public description = "Dual Supertrend trend-following system with ADX strength filtering.";
  public timeframe = "15m";
  public timeframes = ["15m", "30m", "1h"];
  public symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
  public enabled = true;
  public indicatorsRequired = ["atr", "adx"];
  public supportedRegimes = ["Bullish Trend", "Bearish Trend", "TRENDING", "BREAKOUT"];

  private computeSupertrend(candles: any[], period: number, mult: number) {
    const len = candles.length;
    const st = new Array(len).fill(0);
    const dir = new Array(len).fill(1);
    if (len < period + 1) return { st, dir };
    const atr = new Array(len).fill(0);
    let sum = 0;
    for(let i=0; i<len; i++) {
        const tr = i===0 ? candles[i].high - candles[i].low : Math.max(candles[i].high - candles[i].low, Math.abs(candles[i].high - candles[i-1].close), Math.abs(candles[i].low - candles[i-1].close));
        if (i < period) sum += tr;
        if (i === period - 1) atr[i] = sum / period;
        if (i >= period) atr[i] = (atr[i-1] * (period-1) + tr) / period;
    }
    for(let i=0; i<period-1; i++) atr[i] = atr[period-1];
    let upper = candles.map((c, i) => (c.high + c.low)/2 + mult * atr[i]);
    let lower = candles.map((c, i) => (c.high + c.low)/2 - mult * atr[i]);
    for(let i=1; i<len; i++) {
        if (upper[i] > upper[i-1] && candles[i-1].close <= upper[i-1]) upper[i] = upper[i-1];
        if (lower[i] < lower[i-1] && candles[i-1].close >= lower[i-1]) lower[i] = lower[i-1];
    }
    st[0] = lower[0];
    for(let i=1; i<len; i++) {
        if (dir[i-1] === 1) {
            if (candles[i].close < lower[i]) { dir[i] = -1; st[i] = upper[i]; }
            else { dir[i] = 1; st[i] = lower[i]; }
        } else {
            if (candles[i].close > upper[i]) { dir[i] = 1; st[i] = lower[i]; }
            else { dir[i] = -1; st[i] = upper[i]; }
        }
    }
    return { st, dir };
  }

  public analyze(context: StrategyContext): { direction: "LONG" | "SHORT" | "HOLD"; reasoning: string[]; confidence: number } {
    const { candles, indicators } = context;
    const lastIdx = candles.length - 1;
    const adx = indicators.adx?.[lastIdx] ?? 0;

    const fast = this.computeSupertrend(candles, 10, 3);
    const slow = this.computeSupertrend(candles, 12, 3);
    const fDir = fast.dir[lastIdx];
    const sDir = slow.dir[lastIdx];
    const fDirPrev = fast.dir[lastIdx - 1];
    const sDirPrev = slow.dir[lastIdx - 1];

    let direction: "LONG" | "SHORT" | "HOLD" = "HOLD";
    const reasoning: string[] = [];

    // Fresh alignment of both Supertrends with ADX confirmation
    const isBullishAlign = fDir === 1 && sDir === 1 && (fDirPrev === -1 || sDirPrev === -1);
    const isBearishAlign = fDir === -1 && sDir === -1 && (fDirPrev === 1 || sDirPrev === 1);

    if (isBullishAlign && adx > 28) {
      direction = "LONG";
      reasoning.push("Hyper Supertrend: Fast and slow trends aligned BULLISH with high ADX.");
    } else if (isBearishAlign && adx > 28) {
      direction = "SHORT";
      reasoning.push("Hyper Supertrend: Fast and slow trends aligned BEARISH with high ADX.");
    }

    return { direction, reasoning, confidence: 95 };
  }

  public validate(context: StrategyContext): boolean {
    return context.candles.length >= 100 && context.indicators.adx !== undefined;
  }

  public generateSignal(context: StrategyContext): StrategySignal {
    const { direction, reasoning, confidence } = this.analyze(context);
    const { candles, indicators } = context;
    const close = candles[candles.length - 1].close;
    const atr = indicators.atr?.[candles.length - 1] || (close * 0.015);

    const signal = SignalGenerator.createSignal(this.id, direction, confidence, reasoning, context);

    if (direction !== "HOLD") {
      // 1.5x RR for trend following
      signal.stopLoss = Number((close - (direction === "LONG" ? 1.5 : -1.5) * atr).toFixed(4));
      signal.takeProfit = Number((close + (direction === "LONG" ? 2.25 : -2.25) * atr).toFixed(4));
    }

    return signal;
  }

  public evaluate(context: StrategyContext): StrategySignal {
    if (!this.enabled || !this.validate(context)) {
      return SignalGenerator.createSignal(this.id, "HOLD", 0, ["Disabled/Invalid"], context);
    }
    return this.generateSignal(context);
  }
}
