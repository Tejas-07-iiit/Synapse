import { marketCache } from "./cache";
import { fetchHistoricalCandles } from "./candles";
import { marketWsService } from "./websocket";
import { strategyEngine } from "../strategy-engine/core/engine";
import { initializeStrategies } from "../strategy-engine/strategies";
import { useMarketStore, type MarketAnalytics } from "../stores/marketStore";
import { useSignalStore } from "../stores/signalStore";
import { PaperTradingEngine } from "../execution-engine/paper";
import { Candle, TickerInfo, IndicatorValues } from "../strategy-engine/types";
import { calculateMarketAnalytics } from "@/services/analytics/analytics-engine";
import { useSettingsStore } from "@/src/stores/settingsStore";
import { useAuthStore } from "@/store/useAuthStore";

class MarketEngine {
  private activeSymbol: string = "";
  private activeTimeframe: string = "15m";
  private unsubscribeWsCandles: (() => void) | null = null;
  private unsubscribeWsTicker: (() => void) | null = null;
  private initializedTimeframe: string = "";
  private lastCandleOpenTime: Map<string, number> = new Map();

  constructor() {
    // Auto initialize strategy engine setups on instantiation
    initializeStrategies();

    // Register callback to update Zustand store when engine runs
    strategyEngine.registerCallback((symbol, timeframe, regime, signals, indicators) => {
      const marketStore = useMarketStore.getState();
      const sym = symbol.toUpperCase();
      const tf = timeframe.toLowerCase();
      const tfKey = `${sym}_${tf}`;
      
      // Update store cache
      marketStore.setIndicatorsForSymbol(tfKey, indicators);
      
      // Preserve backward compatibility for watchlist row
      if (tf === this.activeTimeframe) {
        marketStore.setIndicatorsForSymbol(sym, indicators);
      }
      
      // If it's the active symbol and active timeframe, update the active indicators
      if (sym === this.activeSymbol && tf === this.activeTimeframe) {
        useMarketStore.setState({
          indicators,
        });
      }
    });
  }

  /**
   * Initializes the market engine for a specific coin and timeframe.
   * Feeds historical candles for all coins, opens WebSocket streams, and registers calculations.
   */
  public async init(symbol: string, timeframe: string): Promise<void> {
    const sym = symbol.toUpperCase();
    const tf = timeframe.toLowerCase();

    const coinsList = useMarketStore.getState().supportedSymbols.length > 0
      ? useMarketStore.getState().supportedSymbols
      : ["BTCUSDT", "ETHUSDT", "SOLUSDT"];

    // Update active symbol in store
    useMarketStore.setState({
      selectedSymbol: sym,
      symbol: sym, // Alias for backward compatibility
      timeframe: tf,
      candles: [], // Clear old candles to prevent UI showing wrong price on switch
      indicators: null,
      analytics: null,
    });

    const isSymbolChangeOnly = this.activeTimeframe === tf && this.activeSymbol !== sym && this.initializedTimeframe === tf;

    this.activeSymbol = sym;
    this.activeTimeframe = tf;

    // If it is just a symbol change (and timeframe is unchanged and already initialized),
    // we only need to sync the active candles and indicators in the store for the UI chart.
    if (isSymbolChangeOnly) {
      const latestState = useMarketStore.getState();
      const tfKey = `${sym}_${tf}`;
      const cachedCandles = latestState.allCandles[tfKey] || latestState.allCandles[sym] || [];
      const cachedIndicators = latestState.allIndicators[tfKey] || latestState.allIndicators[sym] || null;
      const cachedAnalytics = latestState.allAnalytics[tfKey] || latestState.allAnalytics[sym] || null;

      if (cachedCandles.length > 0 && cachedAnalytics) {
        useMarketStore.setState({
          candles: cachedCandles,
          indicators: cachedIndicators,
          analytics: cachedAnalytics,
        });
        return;
      }
    }

    // Otherwise, we do a full initialization of all supported symbols for the timeframe
    useMarketStore.getState().setLoading(true);
    useMarketStore.getState().setError(null);

    try {
      // Unsubscribe from previous streams if timeframe has changed
      if (this.initializedTimeframe && this.initializedTimeframe !== tf) {
        const oldStreams = coinsList.flatMap(s => [
          `${s.toLowerCase()}@kline_5m`,
          `${s.toLowerCase()}@kline_15m`,
          `${s.toLowerCase()}@kline_${this.initializedTimeframe}`
        ]);
        marketWsService.unsubscribe(oldStreams);
      }

      this.initializedTimeframe = tf;

      // 1. MUST LOAD ACTIVE POSITIONS FIRST TO PREVENT BLIND EXECUTION
      const targetUserId = useAuthStore.getState().user?.id || "default-user-id";
      try {
        await PaperTradingEngine.loadActivePositions(targetUserId);
        console.log(`[BOOT] Active positions loaded successfully.`);
      } catch (err) {
        console.error(`[BOOT] Failed to load active positions. Halting autonomous execution on boot.`, err);
      }

      // 2. Fetch historical candles for all coins from REST and compute initial indicators
      const timeframesToLoad = new Set<string>(["5m", "15m", tf]);
      for (const coin of coinsList) {
        for (const t of timeframesToLoad) {
          let candles = marketCache.get(coin, t);
          if (!candles) {
            candles = await fetchHistoricalCandles(coin, t, 1000);
            marketCache.set(coin, t, candles);
          }

          // Store in the symbol-level cache
          useMarketStore.getState().setCandlesForSymbol(coin, t, candles);

          // Run initial calculation (with isClosed = false, isHistoricalBackfill = true)
          const ticker = useMarketStore.getState().tickerData[coin] || null;
          await this.recalculate(coin, t, candles, ticker, false, true);
        }
      }

      // 3. Load the active candles and indicators of the selected symbol for UI chart
      const latestState = useMarketStore.getState();
      const tfKey = `${sym}_${tf}`;
      const activeCandles = latestState.allCandles[tfKey] || latestState.allCandles[sym] || [];
      const activeIndicators = latestState.allIndicators[tfKey] || latestState.allIndicators[sym] || null;
      const activeAnalytics = latestState.allAnalytics[tfKey] || latestState.allAnalytics[sym] || null;

      useMarketStore.setState({
        candles: activeCandles,
        indicators: activeIndicators,
        analytics: activeAnalytics,
      });

      // 4. Connect WebSocket & register callbacks
      marketWsService.connect();
      this.registerWebSocketCallbacks();

      // 5. Subscribe to kline streams for ALL symbols simultaneously
      const streams = coinsList.flatMap(s => [
        `${s.toLowerCase()}@kline_5m`,
        `${s.toLowerCase()}@kline_15m`,
        `${s.toLowerCase()}@kline_${tf}`
      ]);
      marketWsService.subscribe(streams);

      useMarketStore.getState().setLoading(false);
    } catch (error) {
      console.error(`[MarketEngine] Full init failed for ${tf}:`, error);
      useMarketStore.getState().setError((error as Error).message);
      useMarketStore.getState().setLoading(false);
    }
  }

  /**
   * Registers kline and ticker update listeners.
   */
  private registerWebSocketCallbacks() {
    if (this.unsubscribeWsTicker && this.unsubscribeWsCandles) {
      return;
    }

    if (!this.unsubscribeWsTicker) {
      this.unsubscribeWsTicker = marketWsService.registerTickerCallback((symbol, ticker) => {
        const store = useMarketStore.getState();
        const symUpper = symbol.toUpperCase();
        store.updateTicker(symUpper, ticker);

        // Forward ticker updates to paper trading engine to check SL/TP executions for all positions
        PaperTradingEngine.updatePrices(symUpper, ticker.price);
        
        // Note: We DO NOT recalculate indicators or strategies on price ticks anymore.
        // This dramatically saves CPU/RAM. We only evaluate on candle close.
      });
    }

    if (!this.unsubscribeWsCandles) {
      this.unsubscribeWsCandles = marketWsService.registerCandleCallback((symbol, tf, candle, isClosed) => {
        const store = useMarketStore.getState();
        const symUpper = symbol.toUpperCase();
        const tfLower = tf.toLowerCase();

        // 1. Update the symbol-specific candle cache
        store.updateLastCandleForSymbol(symUpper, tfLower, candle);

        // 2. If it's the active symbol and timeframe, update the active candles for UI
        if (symUpper === this.activeSymbol && tfLower === this.activeTimeframe) {
          store.updateLastCandle(candle, isClosed);
        }

        // 3. Centralized Candle Lifecycle management
        const key = `${symUpper}_${tfLower}`;
        const openTime = candle.time;
        const prevOpenTime = this.lastCandleOpenTime.get(key);

        if (!prevOpenTime) {
          this.lastCandleOpenTime.set(key, openTime);
          this.onCandleOpen();
        } else if (openTime > prevOpenTime) {
          this.lastCandleOpenTime.set(key, openTime);
          this.onCandleOpen();
        } else {
          this.onCandleUpdate();
        }

        if (isClosed) {
          this.onCandleClose(symUpper, tfLower);
        }
      });
    }
  }

  private onCandleOpen() {
    // Candle Opened
  }
 
  private onCandleUpdate() {
    // Candle Updated
  }

  private onCandleClose(symbol: string, timeframe: string) {
    console.log(`[CandleLifecycle] 🔴 Candle Closed for ${symbol} (${timeframe})`);
    
    if (timeframe === "5m") {
      this.on5mCandleClose(symbol);
    } else if (timeframe === "15m") {
      this.on15mCandleClose(symbol);
    } else {
      this.onOtherCandleClose(symbol, timeframe);
    }
  }

  private async on5mCandleClose(symbol: string) {
    const store = useMarketStore.getState();
    const updatedCandles = store.allCandles[`${symbol}_5m`] || [];
    const ticker = store.tickerData[symbol] || null;
    await this.recalculate(symbol, "5m", updatedCandles, ticker, true);
  }
 
  private async on15mCandleClose(symbol: string) {
    const store = useMarketStore.getState();
    const updatedCandles = store.allCandles[`${symbol}_15m`] || [];
    const ticker = store.tickerData[symbol] || null;
    await this.recalculate(symbol, "15m", updatedCandles, ticker, true);
  }
 
  private async onOtherCandleClose(symbol: string, timeframe: string) {
    const store = useMarketStore.getState();
    const tfLower = timeframe.toLowerCase();
    const updatedCandles = store.allCandles[`${symbol}_${tfLower}`] || [];
    const ticker = store.tickerData[symbol] || null;
    await this.recalculate(symbol, tfLower, updatedCandles, ticker, true);
  }

  /**
   * Core pipeline: computes indicators, runs strategies, resolves signals,
   * updates Zustand stores, and triggers paper executions.
   */
  private async recalculate(
    symbol: string,
    timeframe: string,
    candles: Candle[],
    ticker: TickerInfo | null,
    isClosed: boolean,
    isHistoricalBackfill: boolean = false
  ) {
    if (candles.length === 0) return;

    const sym = symbol.toUpperCase();
    const tf = timeframe.toLowerCase();
    const tfKey = `${sym}_${tf}`;

    if (!isHistoricalBackfill) {
        console.log(`[MARKET_ENGINE] Recalculating indicators & evaluating strategies for ${sym} (${tf}) | isClosed: ${isClosed}`);
    }
    
    // 1. Evaluate strategies, compute indicators, and fetch prioritized signals
    const { signals, indicators: currentIndicators } = await strategyEngine.processTick(sym, tf, candles, ticker, isClosed);

    const marketStore = useMarketStore.getState();
    const signalStore = useSignalStore.getState();

    if (currentIndicators) {
      // 2. Generate standard market analytics metadata using the helper
      // This bridges the gap between old indicators layout and the new unified engine
      const legacyIndicators = this.mapIndicatorsToLegacy(currentIndicators);
      const legacyCandles = candles.map((c) => ({ 
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
      }));

      const analytics = calculateMarketAnalytics(sym, legacyCandles, legacyIndicators);
      
      // Update marketStore caches
      marketStore.setIndicatorsForSymbol(tfKey, currentIndicators);
      marketStore.setAnalyticsForSymbol(tfKey, analytics as unknown as MarketAnalytics);

      // Preserve backward compatibility for watchlist row
      if (tf === this.activeTimeframe) {
        marketStore.setIndicatorsForSymbol(sym, currentIndicators);
        marketStore.setAnalyticsForSymbol(sym, analytics as unknown as MarketAnalytics);
      }

      // If it's the active symbol and active timeframe, update the active indicators and analytics for UI rendering
      if (sym === this.activeSymbol && tf === this.activeTimeframe) {
        useMarketStore.setState({
          indicators: currentIndicators,
          analytics: analytics as unknown as MarketAnalytics,
        });
      }
    }

    // BLOCK LIVE EXECUTION IF THIS IS A HISTORICAL BACKFILL WARMUP
    if (isHistoricalBackfill) {
       // We still update indicators, but we don't dispatch trades
       return;
    }

    // ONLY ALLOW AUTONOMOUS EXECUTION ON CONFIRMED CANDLE CLOSES
    if (!isClosed) {
        return;
    }

    // 3. Update signalStore with new prioritized signals
    const settings = useSettingsStore.getState();

    for (const sig of signals) {
      const isTradeDirection = sig.signal === "LONG" || sig.signal === "SHORT";
      if (isTradeDirection) {
        const targetUserId = useAuthStore.getState().user?.id || "default-user-id";
        const activePos = PaperTradingEngine.getOpenPositions().find(
          (p) => p.symbol === sym && p.status === "OPEN" && p.userId === targetUserId
        );
        if (activePos) {
          sig.blocked = true;
          sig.blockReason = "ACTIVE POSITION EXISTS";
          sig.activePositionId = activePos.id;
          
          console.log(`[POSITION_LOCK] ${sym} blocked → existing active trade found`);
          console.log(`[TRADE_REJECTED] Reason: Active position already exists for ${sym}`);
        }
      }

      signalStore.addSignal(sig);

      console.log(`[STRATEGY_SIGNAL] Strategy: ${sig.strategyName} | Symbol: ${sig.symbol} | Type: ${sig.signal} | Confidence: ${sig.confidence}% | Price: $${sig.entry}`);

      const isAutonomous = settings.autoTrading || 
        process.env.NEXT_PUBLIC_AUTONOMOUS_TRADING === "true" || 
        process.env.NEXT_PUBLIC_AUTONOMOUS_TRADING === "on";

      console.log(`[EXECUTION_ENGINE] Auto-trading check for ${sym}: isAutonomous = ${isAutonomous} | settings.autoTrading = ${settings.autoTrading} | env = ${process.env.NEXT_PUBLIC_AUTONOMOUS_TRADING}`);

      if (sig.signal === "LONG" || sig.signal === "SHORT") {
        if (sig.blocked) {
          console.log(`[EXECUTION_ENGINE] Signal blocked: Active position already exists for ${sym}`);
          continue;
        }
        if (isAutonomous) {
          const direction: "LONG" | "SHORT" = sig.signal;
          try {
            // Resolve user for trade execution, fallback to default-user-id
            const targetUserId = useAuthStore.getState().user?.id || "default-user-id";
            
            console.log(`[EXECUTION_ENGINE] Attempting to open position for ${sym} (Direction: ${direction}) for User ID: ${targetUserId} via PaperTradingEngine.`);

            // Calculate dynamic SL/TP based on settings if not provided by signal
            const defaultSl = direction === "LONG" 
              ? sig.entry * (1 - settings.defaultSlPct / 100)
              : sig.entry * (1 + settings.defaultSlPct / 100);
            
            const defaultTp = direction === "LONG"
              ? sig.entry * (1 + settings.defaultTpPct / 100)
              : sig.entry * (1 - settings.defaultTpPct / 100);

            const position = await PaperTradingEngine.openPosition(
              targetUserId,
              sym,
              direction,
              sig.entry,
              null, // Size: null (lets PaperTradingEngine calculate dynamically from wallet)
              sig.stopLoss || defaultSl,
              sig.takeProfit || defaultTp,
              1 // Leverage: 1x
            );

            if (position) {
              console.log(`[MarketEngine] ✅ Auto-executed trade: ${direction} ${sym} @ $${sig.entry}`);
            }
          } catch (err) {
            console.error(`[MarketEngine] Auto-execution failed for ${sym}:`, err);
          }
        } else {
          console.log(`[EXECUTION_ENGINE] Signal ignored: ${sig.signal} ${sym} @ $${sig.entry} (Auto-trading is OFF — no trade placed)`);
        }
      }
    }
  }

  /**
   * Helper to map strategy-engine indicators shape to legacy market-engine analytics shape.
   */
  private mapIndicatorsToLegacy(ind: IndicatorValues) {
    return {
      ema12: ind.ema12,
      ema26: ind.ema26,
      ema20: ind.ema20,
      sma50: ind.sma50,
      rsi: ind.rsi,
      macdLine: ind.macdLine,
      signalLine: ind.signalLine,
      macdHist: ind.macdHist,
      bbUpper: ind.bbUpper,
      bbMiddle: ind.bbMiddle,
      bbLower: ind.bbLower,
      atr: ind.atr,
      vwap: ind.vwap,
      volumeMA: ind.volumeMA,
      stochRsiK: ind.stochRsiK,
      stochRsiD: ind.stochRsiD,
      adx: ind.adx,
      supportLevels: ind.supportLevels,
      resistanceLevels: ind.resistanceLevels,
    };
  }

  /**
   * Cleanup connections and timers.
   */
  public destroy() {
    const marketStore = useMarketStore.getState();
    const coinsList = marketStore.supportedSymbols.length > 0
      ? marketStore.supportedSymbols
      : ["BTCUSDT", "ETHUSDT", "SOLUSDT"];

    const streams = coinsList.flatMap(s => [
      `${s.toLowerCase()}@kline_5m`,
      `${s.toLowerCase()}@kline_15m`,
      `${s.toLowerCase()}@kline_${this.activeTimeframe}`
    ]);
    marketWsService.unsubscribe(streams);

    if (this.unsubscribeWsTicker) {
      this.unsubscribeWsTicker();
      this.unsubscribeWsTicker = null;
    }
    if (this.unsubscribeWsCandles) {
      this.unsubscribeWsCandles();
      this.unsubscribeWsCandles = null;
    }
    marketWsService.disconnect();
  }
}

export const marketEngine = new MarketEngine();
export default marketEngine;
