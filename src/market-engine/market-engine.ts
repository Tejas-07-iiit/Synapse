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

class MarketEngine {
  private activeSymbol: string = "";
  private activeTimeframe: string = "15m";
  private unsubscribeWsCandles: (() => void) | null = null;
  private unsubscribeWsTicker: (() => void) | null = null;
  private recalcTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private initializedTimeframe: string = "";
  private static readonly RECALC_THROTTLE_MS = 1500; // Throttle intra-candle updates to 1.5s

  constructor() {
    // Auto initialize strategy engine setups on instantiation
    initializeStrategies();

    // Register callback to update Zustand store when engine runs
    strategyEngine.registerCallback((symbol, timeframe, regime, signals, indicators) => {
      const marketStore = useMarketStore.getState();
      const sym = symbol.toUpperCase();
      
      // Update store cache
      marketStore.setIndicatorsForSymbol(sym, indicators);
      
      // If it's the active symbol, update the active indicators
      if (sym === this.activeSymbol) {
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

    const marketStore = useMarketStore.getState();
    const coinsList = marketStore.supportedSymbols.length > 0
      ? marketStore.supportedSymbols
      : ["BTCUSDT", "ETHUSDT", "SOLUSDT"];

    // Update active symbol in store
    useMarketStore.setState({
      selectedSymbol: sym,
      symbol: sym, // Alias for backward compatibility
      timeframe: tf,
    });

    const isSymbolChangeOnly = this.activeTimeframe === tf && this.activeSymbol !== sym && this.initializedTimeframe === tf;

    this.activeSymbol = sym;
    this.activeTimeframe = tf;

    // If it is just a symbol change (and timeframe is unchanged and already initialized),
    // we only need to sync the active candles and indicators in the store for the UI chart.
    if (isSymbolChangeOnly) {
      const cachedCandles = marketStore.allCandles[sym] || [];
      const cachedIndicators = marketStore.allIndicators[sym] || null;
      const cachedAnalytics = marketStore.allAnalytics[sym] || null;
      useMarketStore.setState({
        candles: cachedCandles,
        indicators: cachedIndicators,
        analytics: cachedAnalytics,
      });
      return;
    }

    // Otherwise, we do a full initialization of all supported symbols for the timeframe
    marketStore.setLoading(true);
    marketStore.setError(null);

    try {
      // Unsubscribe from previous streams if timeframe has changed
      if (this.initializedTimeframe && this.initializedTimeframe !== tf) {
        const oldStreams = coinsList.map(s => `${s.toLowerCase()}@kline_${this.initializedTimeframe}`);
        marketWsService.unsubscribe(oldStreams);
      }

      this.initializedTimeframe = tf;

      // 1. Fetch historical candles for all coins from REST and compute initial indicators
      for (const coin of coinsList) {
        let candles = marketCache.get(coin, tf);
        if (!candles) {
          candles = await fetchHistoricalCandles(coin, tf, 350);
          marketCache.set(coin, tf, candles);
        }

        // Store in the symbol-level cache
        marketStore.setCandlesForSymbol(coin, candles);

        // Run initial calculation
        const ticker = marketStore.tickerData[coin] || null;
        await this.recalculate(coin, tf, candles, ticker);
      }

      // 2. Load the active candles and indicators of the selected symbol for UI chart
      const activeCandles = marketStore.allCandles[sym] || [];
      const activeIndicators = marketStore.allIndicators[sym] || null;
      const activeAnalytics = marketStore.allAnalytics[sym] || null;
      useMarketStore.setState({
        candles: activeCandles,
        indicators: activeIndicators,
        analytics: activeAnalytics,
      });

      // 3. Load active paper positions
      PaperTradingEngine.loadActivePositions("default-user-id").catch(() => {});

      // 4. Connect WebSocket & register callbacks
      marketWsService.connect();
      this.registerWebSocketCallbacks();

      // 5. Subscribe to kline streams for ALL symbols simultaneously
      const streams = coinsList.map(s => `${s.toLowerCase()}@kline_${tf}`);
      marketWsService.subscribe(streams);

      marketStore.setLoading(false);
    } catch (error) {
      console.error(`[MarketEngine] Full init failed for ${tf}:`, error);
      marketStore.setError((error as Error).message);
      marketStore.setLoading(false);
    }
  }

  /**
   * Registers kline and ticker update listeners.
   */
  private registerWebSocketCallbacks() {
    if (this.unsubscribeWsTicker && this.unsubscribeWsCandles) {
      return;
    }

    const marketStore = useMarketStore.getState();

    if (!this.unsubscribeWsTicker) {
      this.unsubscribeWsTicker = marketWsService.registerTickerCallback((symbol, ticker) => {
        const symUpper = symbol.toUpperCase();
        marketStore.updateTicker(symUpper, ticker);

        // Forward ticker updates to paper trading engine to check SL/TP executions for all positions
        PaperTradingEngine.updatePrices(symUpper, ticker.price);

        const candles = marketStore.allCandles[symUpper] || [];
        if (candles.length > 0) {
          this.throttledRecalculate(symUpper, this.activeTimeframe, candles, ticker);
        }
      });
    }

    if (!this.unsubscribeWsCandles) {
      this.unsubscribeWsCandles = marketWsService.registerCandleCallback((symbol, tf, candle, isClosed) => {
        if (tf.toLowerCase() !== this.activeTimeframe) {
          return;
        }

        const symUpper = symbol.toUpperCase();

        // Update the symbol-specific candle cache
        marketStore.updateLastCandleForSymbol(symUpper, candle, isClosed);
        const updatedCandles = marketStore.allCandles[symUpper] || [];

        // If it's the active symbol, update the active candles for UI
        if (symUpper === this.activeSymbol) {
          marketStore.updateLastCandle(candle, isClosed);
        }

        // On candle close, recalculate immediately and refresh cache
        if (isClosed) {
          marketCache.set(symUpper, tf, updatedCandles);
          const ticker = marketStore.tickerData[symUpper] || null;
          this.recalculate(symUpper, tf, updatedCandles, ticker);
          return;
        }

        // Intra-candle update - throttled
        const ticker = marketStore.tickerData[symUpper] || null;
        this.throttledRecalculate(symUpper, tf, updatedCandles, ticker);
      });
    }
  }

  /**
   * Throttled recalculate for real-time price ticks.
   */
  private throttledRecalculate(
    symbol: string,
    timeframe: string,
    candles: Candle[],
    ticker: TickerInfo | null
  ) {
    const sym = symbol.toUpperCase();
    if (this.recalcTimers.has(sym)) return;

    const timer = setTimeout(async () => {
      this.recalcTimers.delete(sym);
      const latestCandles = useMarketStore.getState().allCandles[sym] || candles;
      const latestTicker = useMarketStore.getState().tickerData[sym] || ticker;
      await this.recalculate(sym, timeframe, latestCandles, latestTicker);
    }, MarketEngine.RECALC_THROTTLE_MS);

    this.recalcTimers.set(sym, timer);
  }

  /**
   * Core pipeline: computes indicators, runs strategies, resolves signals,
   * updates Zustand stores, and triggers paper executions.
   */
  private async recalculate(
    symbol: string,
    timeframe: string,
    candles: Candle[],
    ticker: TickerInfo | null
  ) {
    if (candles.length === 0) return;

    const sym = symbol.toUpperCase();
    const tf = timeframe.toLowerCase();

    // 1. Evaluate strategies, compute indicators, and fetch prioritized signals
    const signals = await strategyEngine.processTick(sym, tf, candles, ticker);

    const marketStore = useMarketStore.getState();
    const signalStore = useSignalStore.getState();

    // Fetch computed indicators from cache
    const currentIndicators = useMarketStore.getState().allIndicators[sym] || null;

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
      marketStore.setIndicatorsForSymbol(sym, currentIndicators);
      marketStore.setAnalyticsForSymbol(sym, analytics as unknown as MarketAnalytics);

      // If it's the active symbol, update the active indicators and analytics for UI rendering
      if (sym === this.activeSymbol) {
        useMarketStore.setState({
          indicators: currentIndicators,
          analytics: analytics as unknown as MarketAnalytics,
        });
      }
    }

    // 3. Update signalStore with new prioritized signals
    const settings = useSettingsStore.getState();

    for (const sig of signals) {
      signalStore.addSignal(sig);

      const isAutonomous = settings.autoTrading;

      if (sig.signal === "LONG" || sig.signal === "SHORT") {
        if (isAutonomous) {
          const direction: "LONG" | "SHORT" = sig.signal;
          try {
            // Resolve user for trade execution, fallback to default-user-id
            const targetUserId = "default-user-id";
            
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
          console.log(`[MarketEngine] Signal generated: ${sig.signal} ${sym} @ $${sig.entry} (AUTONOMOUS_TRADING is OFF — signal only, no trade executed)`);
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
    this.recalcTimers.forEach((timer) => clearTimeout(timer));
    this.recalcTimers.clear();

    const marketStore = useMarketStore.getState();
    const coinsList = marketStore.supportedSymbols.length > 0
      ? marketStore.supportedSymbols
      : ["BTCUSDT", "ETHUSDT", "SOLUSDT"];

    const streams = coinsList.map(s => `${s.toLowerCase()}@kline_${this.activeTimeframe}`);
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
