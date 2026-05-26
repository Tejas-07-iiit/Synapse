import { useEffect } from "react";
import { useMarketStore } from "@/store/market/useMarketStore";
import { useDashboardStore } from "@/store/dashboard/useDashboardStore";
import { marketEngine } from "@/services/market/market-engine";

/**
 * Reusable React hook connecting components to the Synapse Market Engine.
 * Automatically synchronizes historical fetches and WS subscriptions on symbol/timeframe switches.
 * Optimized to only subscribe to symbol and timeframe, preventing excessive re-renders of the calling component.
 */
export function useMarketEngine() {
  const selectedSymbol = useDashboardStore((state) => state.selectedSymbol);
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

  return {
    symbol: selectedSymbol,
    timeframe,
    candles: useMarketStore.getState().candles,
    indicators: useMarketStore.getState().indicators,
    analytics: useMarketStore.getState().analytics,
    loading: useMarketStore.getState().loading,
    error: useMarketStore.getState().error,
  };
}
