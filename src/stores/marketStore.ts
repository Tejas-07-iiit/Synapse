import { create } from "zustand";
import { Candle, TickerInfo, IndicatorValues } from "../strategy-engine/types";
import { MarketRegime } from "../strategy-engine/core/regime-engine";

export interface MarketAnalytics {
  symbol: string;
  trendDirection: "BULLISH" | "BEARISH" | "NEUTRAL";
  rsiStatus: "OVERBOUGHT" | "OVERSOLD" | "NEUTRAL";
  volatilityScore: "HIGH" | "LOW" | "NORMAL";
  momentumScore: "STRONG" | "WEAK" | "NEUTRAL";
  volumeStrength: "HIGH" | "LOW" | "NORMAL";
  marketRegime: MarketRegime | "BULLISH" | "BEARISH" | "SIDEWAYS" | "VOLATILE" | "ACCUMULATION" | "DISTRIBUTION";
  emaAlignment: "BULLISH" | "BEARISH" | "NEUTRAL";
  bollingerPosition: "ABOVE_UPPER" | "BELOW_LOWER" | "IN_CHANNEL";
  macdStatus: "BULLISH_CROSSOVER" | "BEARISH_CROSSOVER" | "NEUTRAL";
  marketScore: number;
  summary: string;
}

interface MarketState {
  // Config
  selectedSymbol: string;
  symbol: string; // Backward compatibility alias
  supportedSymbols: string[];
  timeframe: string;
  loading: boolean;
  error: string | null;

  // Active symbol details
  candles: Candle[];
  indicators: IndicatorValues | null;
  analytics: MarketAnalytics | null;

  // Watchlist & Cache states
  tickerData: Record<string, TickerInfo>;
  allIndicators: Record<string, IndicatorValues>;
  allAnalytics: Record<string, MarketAnalytics>;
  allCandles: Record<string, Candle[]>;

  // WebSocket connections
  wsConnected: boolean;
  wsStatus: "CONNECTED" | "RECONNECTING" | "DISCONNECTED";
  wsError: string | null;

  // Actions
  setSymbol: (symbol: string) => void;
  setTimeframe: (timeframe: string) => void;
  setSupportedSymbols: (symbols: string[]) => void;
  setCandles: (candles: Candle[]) => void;
  setIndicators: (indicators: IndicatorValues | null) => void;
  setAnalytics: (analytics: MarketAnalytics | null) => void;
  setIndicatorsForSymbol: (symbol: string, indicators: IndicatorValues) => void;
  setAnalyticsForSymbol: (symbol: string, analytics: MarketAnalytics) => void;
  setCandlesForSymbol: (symbol: string, timeframe: string, candles: Candle[]) => void;
  updateLastCandleForSymbol: (symbol: string, timeframe: string, candle: Candle, isClosed: boolean) => void;
  updateTicker: (symbol: string, ticker: TickerInfo) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setWsConnectionState: (connected: boolean, error?: string | null) => void;
  setWsStatus: (status: "CONNECTED" | "RECONNECTING" | "DISCONNECTED") => void;
  updateLastCandle: (candle: Candle, isClosed: boolean) => void;
}

export const useMarketStore = create<MarketState>((set) => ({
  selectedSymbol: "BTCUSDT",
  symbol: "BTCUSDT",
  supportedSymbols: [],
  timeframe: "15m",
  loading: false,
  error: null,
  candles: [],
  indicators: null,
  analytics: null,
  tickerData: {},
  allIndicators: {},
  allAnalytics: {},
  allCandles: {},
  wsConnected: false,
  wsStatus: "DISCONNECTED",
  wsError: null,

  setSymbol: (symbol) => set({ 
    selectedSymbol: symbol.toUpperCase(), 
    symbol: symbol.toUpperCase(),
    candles: [], // Clear active candles to prevent stale data leak
    indicators: null,
    analytics: null
  }),
  setTimeframe: (timeframe) => set({ 
    timeframe,
    candles: [], // Clear active candles to prevent stale data leak
    indicators: null,
    analytics: null
  }),
  setSupportedSymbols: (symbols) =>
    set((state) => ({
      supportedSymbols: symbols.map((s) => s.toUpperCase()),
      selectedSymbol:
        symbols.length > 0 ? symbols[0].toUpperCase() : state.selectedSymbol,
      symbol:
        symbols.length > 0 ? symbols[0].toUpperCase() : state.symbol,
    })),
  setCandles: (candles) => set({ candles }),
  setIndicators: (indicators) => set({ indicators }),
  setAnalytics: (analytics) => set({ analytics }),
  setIndicatorsForSymbol: (symbol, indicators) =>
    set((state) => {
      const sym = symbol.toUpperCase();
      const isCurrentlyActive = sym === state.selectedSymbol;
      return {
        allIndicators: {
          ...state.allIndicators,
          [sym]: indicators,
        },
        ...(isCurrentlyActive ? { indicators } : {})
      };
    }),
  setAnalyticsForSymbol: (symbol, analytics) =>
    set((state) => {
      const sym = symbol.toUpperCase();
      const isCurrentlyActive = sym === state.selectedSymbol;
      return {
        allAnalytics: {
          ...state.allAnalytics,
          [sym]: analytics,
        },
        ...(isCurrentlyActive ? { analytics } : {})
      };
    }),
  setCandlesForSymbol: (symbol, timeframe, candles) =>
    set((state) => {
      const sym = symbol.toUpperCase();
      const tf = timeframe.toLowerCase();
      const cacheKey = `${sym}_${tf}`;
      
      const isCurrentlyActive = sym === state.selectedSymbol && tf === state.timeframe;

      return {
        allCandles: {
          ...state.allCandles,
          [cacheKey]: [...candles],
        },
        ...(isCurrentlyActive ? { candles: [...candles] } : {})
      };
    }),
  updateLastCandleForSymbol: (symbol, timeframe, candle, _isClosed) =>
    set((state) => {
      const sym = symbol.toUpperCase();
      const tf = timeframe.toLowerCase();
      const cacheKey = `${sym}_${tf}`;
      const currentCandles = state.allCandles[cacheKey] ? [...state.allCandles[cacheKey]] : [];
      
      if (currentCandles.length === 0) {
        const updatedAllCandles = {
          ...state.allCandles,
          [cacheKey]: [candle],
        };
        const isCurrentlyActive = sym === state.selectedSymbol && tf === state.timeframe;
        return {
          allCandles: updatedAllCandles,
          ...(isCurrentlyActive ? { candles: [candle] } : {})
        };
      }

      const lastCandle = currentCandles[currentCandles.length - 1];
      if (lastCandle.time === candle.time) {
        currentCandles[currentCandles.length - 1] = candle;
      } else {
        currentCandles.push(candle);
        if (currentCandles.length > 1000) {
          currentCandles.shift();
        }
      }

      const isCurrentlyActive = sym === state.selectedSymbol && tf === state.timeframe;
      return {
        allCandles: {
          ...state.allCandles,
          [cacheKey]: currentCandles,
        },
        ...(isCurrentlyActive ? { candles: currentCandles } : {})
      };
    }),
  updateTicker: (symbol, ticker) =>
    set((state) => ({
      tickerData: {
        ...state.tickerData,
        [symbol.toUpperCase()]: ticker,
      },
    })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setWsConnectionState: (connected, error = null) =>
    set({
      wsConnected: connected,
      wsError: error,
      wsStatus: connected
        ? "CONNECTED"
        : error
        ? "DISCONNECTED"
        : "RECONNECTING",
    }),
  setWsStatus: (status) => set({ wsStatus: status }),
  updateLastCandle: (candle) =>
    set((state) => {
      const candles = [...state.candles];
      if (candles.length === 0) {
        return { candles: [candle] };
      }

      const lastCandle = candles[candles.length - 1];

      if (lastCandle.time === candle.time) {
        candles[candles.length - 1] = candle;
      } else {
        candles.push(candle);
        if (candles.length > 1000) {
          candles.shift();
        }
      }

      return { candles };
    }),
}));
