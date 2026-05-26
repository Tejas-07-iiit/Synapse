import { useEffect } from "react";
import { useMarketStore } from "@/store/market/useMarketStore";
import { useDashboardStore } from "@/store/dashboard/useDashboardStore";
import { marketEngine } from "@/services/market/market-engine";

/**
 * Reusable React hook connecting components to the Synapse Market Engine.
 * Automatically synchronizes historical fetches and WS subscriptions on symbol/timeframe switches.
 */
export function useMarketEngine() {
  const selectedSymbol = useDashboardStore((state) => state.selectedSymbol);
  const timeframe = useMarketStore((state) => state.timeframe);
  const candles = useMarketStore((state) => state.candles);
  const indicators = useMarketStore((state) => state.indicators);
  const analytics = useMarketStore((state) => state.analytics);
  const loading = useMarketStore((state) => state.loading);
  const error = useMarketStore((state) => state.error);

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
    candles,
    indicators,
    analytics,
    loading,
    error,
  };
}
