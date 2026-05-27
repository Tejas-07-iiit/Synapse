import { useEffect } from "react";
import { useMarketStore } from "@/src/stores/marketStore";
import { marketEngine } from "@/src/market-engine/market-engine";

/**
 * Reusable React hook connecting components to the Synapse Market Engine.
 * Automatically synchronizes historical fetches and WS subscriptions on symbol/timeframe switches.
 * Optimized to only subscribe to symbol and timeframe, preventing excessive re-renders of the calling component.
 */
export function useMarketEngine() {
  const selectedSymbol = useMarketStore((state) => state.selectedSymbol);
  const timeframe = useMarketStore((state) => state.timeframe);

  useEffect(() => {
    if (!selectedSymbol || !timeframe) return;

    const startEngine = async () => {
      try {
        await marketEngine.init(selectedSymbol, timeframe);
      } catch (err) {
        console.error("[useMarketEngine] Failed starting market engine:", err);
      }
    };

    startEngine();
  }, [selectedSymbol, timeframe]);

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
