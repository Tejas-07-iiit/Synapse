import { create } from "zustand";
import { Candle, IndicatorValues, MarketAnalytics } from "@/types/market";
import { MarketInterval } from "@/services/market/intervals";

interface MarketState {
  symbol: string;
  candles: Candle[];
  indicators: IndicatorValues | null;
  analytics: MarketAnalytics | null;
  timeframe: MarketInterval;
  loading: boolean;
  error: string | null;
  allIndicators: Record<string, IndicatorValues>;
  allAnalytics: Record<string, MarketAnalytics>;

  setSymbol: (symbol: string) => void;
  setCandles: (candles: Candle[]) => void;
  setTimeframe: (timeframe: MarketInterval) => void;
  setIndicators: (indicators: IndicatorValues | null) => void;
  setAnalytics: (analytics: MarketAnalytics | null) => void;
  setIndicatorsForSymbol: (symbol: string, indicators: IndicatorValues) => void;
  setAnalyticsForSymbol: (symbol: string, analytics: MarketAnalytics) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  updateLastCandle: (candle: Candle, isClosed: boolean) => void;
}

export const useMarketStore = create<MarketState>((set) => ({
  symbol: "BTCUSDT",
  candles: [],
  indicators: null,
  analytics: null,
  timeframe: "15m", // Default timeframe
  loading: false,
  error: null,
  allIndicators: {},
  allAnalytics: {},

  setSymbol: (symbol) => set({ symbol: symbol.toUpperCase() }),
  setCandles: (candles) => set({ candles }),
  setTimeframe: (timeframe) => set({ timeframe }),
  setIndicators: (indicators) => set({ indicators }),
  setAnalytics: (analytics) => set({ analytics }),
  setIndicatorsForSymbol: (symbol, indicators) =>
    set((state) => ({
      allIndicators: {
        ...state.allIndicators,
        [symbol.toUpperCase()]: indicators,
      },
    })),
  setAnalyticsForSymbol: (symbol, analytics) =>
    set((state) => ({
      allAnalytics: {
        ...state.allAnalytics,
        [symbol.toUpperCase()]: analytics,
      },
    })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  updateLastCandle: (candle, isClosed) =>
    set((state) => {
      const candles = [...state.candles];
      if (candles.length === 0) {
        return { candles: [candle] };
      }

      const lastCandle = candles[candles.length - 1];
      
      if (lastCandle.time === candle.time) {
        // Update the current last candle
        candles[candles.length - 1] = candle;
      } else {
        // If the candle time is newer, check if the previous last candle was closed.
        // Binance can send a tick with a new timestamp. We append it.
        candles.push(candle);
        // Keep candle array length bounded, e.g. max 1000 candles to prevent memory leaks
        if (candles.length > 1000) {
          candles.shift();
        }
      }

      return { candles };
    }),
}));
