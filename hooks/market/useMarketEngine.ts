import { useMarketStore } from "@/src/stores/marketStore";

/**
 * Reusable React hook connecting components to the Synapse Market Engine.
 * Provides synchronized data from the global store.
 * The actual engine initialization is now handled globally by RealtimeProvider.
 */
export function useMarketEngine() {
  const selectedSymbol = useMarketStore((state) => state.selectedSymbol);
  const timeframe = useMarketStore((state) => state.timeframe);

  // Return from store state to ensure consistency across UI layers
  return {
    symbol: selectedSymbol,
    timeframe,
    candles: useMarketStore((state) => state.candles),
    indicators: useMarketStore((state) => state.indicators),
    analytics: useMarketStore((state) => state.analytics),
    loading: useMarketStore((state) => state.loading),
    error: useMarketStore((state) => state.error),
  };
}
