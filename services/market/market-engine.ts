import { marketCache } from "./cache";
import { fetchHistoricalCandles } from "./candles";
import { MarketInterval } from "./intervals";
import { marketWsService } from "@/services/websocket/websocket-service";
import { calculateAllIndicators } from "@/services/indicators";
import { calculateMarketAnalytics } from "./analytics-helper";
import { StrategyOrchestrator } from "@/services/strategies/orchestrator/StrategyOrchestrator";
import { useMarketStore } from "@/store/market/useMarketStore";
import { useDashboardStore } from "@/store/dashboard/useDashboardStore";
import { Candle, IndicatorValues, TickerInfo } from "@/types/market";
import { fetch24hTicker } from "./ticker";
import { StrategyContext } from "@/types/strategy";

class MarketEngine {
  private activeSymbol: string = "";
  private activeTimeframe: MarketInterval = "15m";
  private unsubscribeWsCandles: (() => void) | null = null;
  private unsubscribeWsTicker: (() => void) | null = null;

  /**
   * Initializes the market engine for a specific symbol and timeframe.
   * Handles stream unsubscribing, historical fetches, caching, recalculations,
   * and websocket stream subscriptions.
   */
  public async init(symbol: string, timeframe: MarketInterval): Promise<void> {
    const sym = symbol.toUpperCase();

    // If symbol and timeframe are unchanged, just ensure WS is open
    if (this.activeSymbol === sym && this.activeTimeframe === timeframe) {
      marketWsService.connect();
      this.registerWebSocketCallbacks();
      return;
    }

    const prevSymbol = this.activeSymbol;
    const prevTimeframe = this.activeTimeframe;

    this.activeSymbol = sym;
    this.activeTimeframe = timeframe;

    // Sync Zustand configurations
    useDashboardStore.getState().setSymbol(sym);

    // Unsubscribe from previous streams
    if (prevSymbol) {
      const prevKlineStream = `${prevSymbol.toLowerCase()}@kline_${prevTimeframe}`;
      const prevTickerStream = `${prevSymbol.toLowerCase()}@ticker`;
      marketWsService.unsubscribe([prevKlineStream, prevTickerStream]);
    }

    // Set loading state
    useMarketStore.getState().setLoading(true);
    useMarketStore.getState().setError(null);

    try {
      // 1. Fetch candles (cache-first check)
      let candles = marketCache.get(sym, timeframe);
      if (!candles) {
        candles = await fetchHistoricalCandles(sym, timeframe, 500);
        marketCache.set(sym, timeframe, candles);
      }

      // 2. Fetch 24h ticker info
      let ticker: TickerInfo | null = null;
      try {
        ticker = await fetch24hTicker(sym);
        useDashboardStore.getState().updateTicker(sym, ticker);
      } catch (err) {
        console.error(`[MarketEngine] Failed to fetch ticker for ${sym}:`, err);
      }

      // 3. Write loaded candles, symbol, timeframe, and clear indicators atomically to store
      useMarketStore.setState({
        symbol: sym,
        timeframe,
        candles,
        indicators: null,
      });
      this.recalculate(sym, timeframe, candles, ticker);

      // 4. Connect Websocket
      marketWsService.connect();

      // 5. Setup event subscriptions
      this.registerWebSocketCallbacks();

      // 6. Subscribe to new streams
      const newKlineStream = `${sym.toLowerCase()}@kline_${timeframe}`;
      const newTickerStream = `${sym.toLowerCase()}@ticker`;
      marketWsService.subscribe([newKlineStream, newTickerStream]);

      useMarketStore.getState().setLoading(false);
    } catch (error) {
      console.error(`[MarketEngine] Init failed for ${sym} (${timeframe}):`, error);
      useMarketStore.getState().setError((error as Error).message);
      useMarketStore.getState().setLoading(false);
    }
  }

  /**
   * Registers websocket listener callbacks.
   */
  private registerWebSocketCallbacks() {
    // Prevent registering multiple times
    if (this.unsubscribeWsTicker && this.unsubscribeWsCandles) {
      return;
    }

    if (!this.unsubscribeWsTicker) {
      this.unsubscribeWsTicker = marketWsService.registerTickerCallback((symbol, ticker) => {
        useDashboardStore.getState().updateTicker(symbol, ticker);

        // If the update belongs to our active symbol, run strategy evaluations
        if (symbol.toUpperCase() === this.activeSymbol) {
          const candles = useMarketStore.getState().candles;
          const indicators = useMarketStore.getState().indicators;
          if (candles.length > 0 && indicators) {
            this.runStrategies(symbol, this.activeTimeframe, candles, ticker, indicators);
          }
        }
      });
    }

    if (!this.unsubscribeWsCandles) {
      this.unsubscribeWsCandles = marketWsService.registerCandleCallback((symbol, timeframe, candle, isClosed) => {
        if (symbol.toUpperCase() !== this.activeSymbol || timeframe !== this.activeTimeframe) {
          return;
        }

        const marketStore = useMarketStore.getState();
        marketStore.updateLastCandle(candle, isClosed);

        const updatedCandles = marketStore.candles;

        // If candle period closed, cache the snapshot
        if (isClosed) {
          marketCache.set(symbol, timeframe, updatedCandles);
        }

        const ticker = useDashboardStore.getState().tickerData[symbol.toUpperCase()] || null;
        this.recalculate(symbol, timeframe, updatedCandles, ticker);
      });
    }
  }

  /**
   * Triggers indicators, analytics, and strategy signal calculations.
   */
  private recalculate(symbol: string, timeframe: MarketInterval, candles: Candle[], ticker: TickerInfo | null) {
    if (candles.length === 0) return;

    // 1. Calculate technical indicator arrays
    const indicators = calculateAllIndicators(candles);
    useMarketStore.getState().setIndicators(indicators);
    useMarketStore.getState().setIndicatorsForSymbol(symbol, indicators);

    // 2. Generate market analytics metadata
    const analytics = calculateMarketAnalytics(symbol, candles, indicators);
    useMarketStore.getState().setAnalytics(analytics);
    useMarketStore.getState().setAnalyticsForSymbol(symbol, analytics);

    // 3. Evaluate active strategies
    this.runStrategies(symbol, timeframe, candles, ticker, indicators);
  }

  /**
   * Runs the strategy orchestrator pipeline.
   */
  private runStrategies(
    symbol: string,
    timeframe: MarketInterval,
    candles: Candle[],
    ticker: TickerInfo | null,
    indicators: IndicatorValues
  ) {
    const context: StrategyContext = {
      symbol,
      timeframe,
      candles,
      ticker,
      indicators,
    };
    StrategyOrchestrator.run(context);
  }

  /**
   * Cleans up subscriptions and closes WS connections.
   */
  public destroy() {
    if (this.activeSymbol) {
      const klineStream = `${this.activeSymbol.toLowerCase()}@kline_${this.activeTimeframe}`;
      const tickerStream = `${this.activeSymbol.toLowerCase()}@ticker`;
      marketWsService.unsubscribe([klineStream, tickerStream]);
    }

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
