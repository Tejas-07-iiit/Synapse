import { Candle, TickerInfo, StrategyContext, StrategySignal, IndicatorValues } from "../types";
import { calculateAllIndicators } from "../indicators";
import { strategyRegistry } from "./registry";
import { StrategyRunner } from "./strategy-runner";
import { SignalPriorityEngine } from "./signal-priority";
import { RegimeEngine, MarketRegime } from "./regime-engine";
import { StructureEngine } from "./structure-engine";

// Custom type for engine run callback/store hooks
export type EngineRunCallback = (
  symbol: string,
  timeframe: string,
  regime: MarketRegime,
  signals: StrategySignal[],
  indicators: IndicatorValues,
  rawSignals?: StrategySignal[]
) => void;

export interface SignalsDbHandler {
  logStrategyRun: (data: any) => Promise<any>;
  logSignals: (signals: any[]) => Promise<any>;
  logIndicatorSnapshot: (data: any) => Promise<any>;
}

export interface FunnelMetrics {
  rawEvaluations: number;
  structurePassed: number;
  structureRejected: number;
  regimePassed: number;
  regimeRejected: number;
  confidencePassed: number;
  confidenceRejected: number;
  executed: number;
}

class StrategyEngine {
  private callbacks: Set<EngineRunCallback> = new Set();
  private signalLocks: Set<string> = new Set();
  private lastEmittedSignals: Map<string, "LONG" | "SHORT"> = new Map();
  private dbHandler: SignalsDbHandler | null = null;

  public funnelMetrics: FunnelMetrics = {
    rawEvaluations: 0,
    structurePassed: 0,
    structureRejected: 0,
    regimePassed: 0,
    regimeRejected: 0,
    confidencePassed: 0,
    confidenceRejected: 0,
    executed: 0,
  };

  public resetFunnelMetrics() {
    this.funnelMetrics = {
      rawEvaluations: 0,
      structurePassed: 0,
      structureRejected: 0,
      regimePassed: 0,
      regimeRejected: 0,
      confidencePassed: 0,
      confidenceRejected: 0,
      executed: 0,
    };
  }

  public registerDbHandler(handler: SignalsDbHandler) {
    this.dbHandler = handler;
  }

  public registerCallback(cb: EngineRunCallback) {
    this.callbacks.add(cb);
    return () => this.callbacks.delete(cb);
  }

  private sliceIndicators(indicators: IndicatorValues, length: number): IndicatorValues {
    return {
      ema12: indicators.ema12.slice(0, length),
      ema26: indicators.ema26.slice(0, length),
      ema20: indicators.ema20.slice(0, length),
      sma50: indicators.sma50.slice(0, length),
      rsi: indicators.rsi.slice(0, length),
      macdLine: indicators.macdLine.slice(0, length),
      signalLine: indicators.signalLine.slice(0, length),
      macdHist: indicators.macdHist.slice(0, length),
      bbUpper: indicators.bbUpper.slice(0, length),
      bbMiddle: indicators.bbMiddle.slice(0, length),
      bbLower: indicators.bbLower.slice(0, length),
      atr: indicators.atr.slice(0, length),
      vwap: indicators.vwap.slice(0, length),
      volumeMA: indicators.volumeMA.slice(0, length),
      stochRsiK: indicators.stochRsiK.slice(0, length),
      stochRsiD: indicators.stochRsiD.slice(0, length),
      adx: indicators.adx.slice(0, length),
      supportLevels: indicators.supportLevels.slice(0, length),
      resistanceLevels: indicators.resistanceLevels.slice(0, length),
      donchianUpper: indicators.donchianUpper?.slice(0, length),
      donchianLower: indicators.donchianLower?.slice(0, length),
      donchianMiddle: indicators.donchianMiddle?.slice(0, length),
      mfi: indicators.mfi?.slice(0, length),
      momentum: indicators.momentum?.slice(0, length),
      structure: indicators.structure,
    };
  }

  /**
   * Main entrypoint triggered on every websocket price tick or candle update.
   */
  public async processTick(
    symbol: string,
    timeframe: string,
    candles: Candle[],
    ticker: TickerInfo | null,
    isClosed: boolean,
    allTimeframesCachedIndicators?: Record<string, IndicatorValues>
  ): Promise<{ signals: StrategySignal[]; indicators: IndicatorValues }> {
    if (candles.length === 0) return { signals: [], indicators: {} as IndicatorValues };

    const sym = symbol.toUpperCase();
    const tf = timeframe.toLowerCase();

    // 1. Calculate memoized indicators
    const indicators = calculateAllIndicators(sym, tf, candles);

    // 2. Setup the strategy evaluation context
    // If not closed (e.g. during initial REST fetch), the very last candle is the current ticking candle.
    // We should only run strategies on closed candles to avoid noise/spam.
    let strategyCandles = candles;
    let strategyIndicators = indicators;

    if (!isClosed && candles.length >= 2) {
      strategyCandles = candles.slice(0, -1);
      strategyIndicators = this.sliceIndicators(indicators, strategyCandles.length);
    }

    // 2.5 Calculate centralized market structure details
    const structure = StructureEngine.calculate(sym, tf, strategyCandles, strategyIndicators);
    indicators.structure = structure;
    if (strategyIndicators !== indicators) {
      strategyIndicators.structure = structure;
    }

    // 3. Classify market regime
    const context: StrategyContext = {
      symbol: sym,
      timeframe: tf,
      candles: strategyCandles,
      ticker,
      indicators: strategyIndicators,
      historicalIndicators: allTimeframesCachedIndicators,
      structure,
    };
    
    const regime = RegimeEngine.classify(context);

    // 4. Evaluate all registered strategies
    const rawSignals: StrategySignal[] = [];
    const activeStrategies = strategyRegistry.getStrategies();

    for (const strategy of activeStrategies) {
      if (strategy.enabled === false) {
        continue;
      }
      const supportsSymbol = !strategy.symbols || strategy.symbols.map(s => s.toUpperCase()).includes(sym);
      const supportsTimeframe = 
        (strategy.timeframe && strategy.timeframe.toLowerCase() === tf) ||
        (strategy.timeframes && strategy.timeframes.map(t => t.toLowerCase()).includes(tf)) ||
        (!strategy.timeframe && !strategy.timeframes);

      if (supportsSymbol && supportsTimeframe) {
        this.funnelMetrics.rawEvaluations++;

        const isStructureAligned = structure.dowStructure === "BULLISH" || structure.dowStructure === "BEARISH";
        if (isStructureAligned) {
          this.funnelMetrics.structurePassed++;
        } else {
          this.funnelMetrics.structureRejected++;
        }

        // Enforce Regime check BEFORE execution
        if (strategy.supportedRegimes && !RegimeEngine.matches(regime, strategy.supportedRegimes)) {
          this.funnelMetrics.regimeRejected++;
          continue;
        }
        this.funnelMetrics.regimePassed++;

        const lastCandleTime = strategyCandles[strategyCandles.length - 1]?.time || 0;
        const lockKey = `${sym}_${tf}_${strategy.id}_${lastCandleTime}`;
        if (this.signalLocks.has(lockKey)) {
          continue;
        }

        const { signal, latencyMs } = StrategyRunner.run(strategy, context);
        
        if (signal) {
          this.signalLocks.add(lockKey);
          if (this.signalLocks.size > 10000) {
            const firstKey = this.signalLocks.values().next().value;
            if (firstKey) this.signalLocks.delete(firstKey);
          }

          // Central signal de-duplication
          if (signal.signal !== "HOLD") {
            const dupKey = `${strategy.id}_${sym}_${tf}`;
            const lastSig = this.lastEmittedSignals.get(dupKey);
            if (lastSig === signal.signal) {
              signal.signal = "HOLD";
              signal.signalType = "HOLD";
              signal.confidence = 0;
              signal.reasoning = [`Duplicate suppressed: same direction as last emitted signal (${lastSig})`];
            } else {
              this.lastEmittedSignals.set(dupKey, signal.signal);
            }
          }

          rawSignals.push(signal);
          
          // Background database logging for auditing strategy runs
          this.logStrategyRunToDb(strategy.id, sym, tf, signal.signal, latencyMs).catch((err) =>
            console.error(`[Engine] Failed to write strategy run to database:`, err)
          );
        }
      }
    }

    // 4. Run priority, suppression, and conflict resolution
    const prioritizedSignals = SignalPriorityEngine.prioritize(rawSignals);

    // 5. Trigger callbacks to update global Zustand stores and paper trading executions
    this.callbacks.forEach((cb) => {
      try {
        cb(sym, tf, regime, prioritizedSignals, indicators, rawSignals);
      } catch (err) {
        console.error(`[Engine] Callback execution error:`, err);
      }
    });

    // 6. DB logging for generated signals and indicator snapshots
    if (prioritizedSignals.length > 0) {
      this.logSignalsToDb(prioritizedSignals).catch((err) =>
        console.error(`[Engine] Failed to log signals to DB:`, err)
      );
    }
    this.logIndicatorSnapshotToDb(sym, tf, candles[candles.length - 1].time, indicators).catch((err) =>
      console.error(`[Engine] Failed to log indicator snapshot to DB:`, err)
    );

    console.log(`[FLOW_03] Processed tick, generated prioritized signals: ${prioritizedSignals.length} (raw: ${rawSignals.length})`);
    return { signals: prioritizedSignals, indicators };
  }

  /**
   * Log individual strategy evaluation statistics into the database.
   */
  private async logStrategyRunToDb(
    strategyId: string,
    symbol: string,
    timeframe: string,
    result: string,
    durationMs: number
  ) {
    if (this.dbHandler) {
      this.dbHandler.logStrategyRun({ strategyId, symbol, timeframe, result, durationMs }).catch(() => {});
      return;
    }
    try {
      await fetch("/api/signals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "strategy-run",
          data: { strategyId, symbol, timeframe, result, durationMs }
        })
      });
    } catch {
      // Fail silently to avoid breaking the core loop
    }
  }

  /**
   * Log generated signals to the postgres audit log.
   */
  private async logSignalsToDb(signals: StrategySignal[]) {
    if (this.dbHandler) {
      this.dbHandler.logSignals(signals).catch(() => {});
      return;
    }
    try {
      await fetch("/api/signals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "signals",
          data: { signals }
        })
      });
    } catch {
      // Fail silently to avoid blocking the WebSocket loop
    }
  }

  /**
   * Log indicator metrics snapshot for research and analytics.
   */
  private async logIndicatorSnapshotToDb(
    symbol: string,
    timeframe: string,
    timestamp: number,
    indicators: IndicatorValues
  ) {
    if (this.dbHandler) {
      this.dbHandler.logIndicatorSnapshot({ symbol, timeframe, timestamp, indicators }).catch(() => {});
      return;
    }
    try {
      await fetch("/api/signals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "indicator-snapshot",
          data: { symbol, timeframe, timestamp, indicators }
        })
      });
    } catch {
      // Fail silently
    }
  }
}

export const strategyEngine = new StrategyEngine();
