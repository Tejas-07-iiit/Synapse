"use client";

import React, { useEffect } from "react";
import { useDashboardStore } from "@/store/dashboard/useDashboardStore";
import { useMarketEngine } from "@/hooks/market/useMarketEngine";
import { fetch24hTickers } from "@/services/market/ticker";
import { marketWsService } from "@/services/websocket/websocket-service";
import Sidebar from "@/components/sidebar/Sidebar";
import Navbar from "@/components/navbar/Navbar";
import MarketCards from "@/components/dashboard/MarketCards";
import TradingViewChart from "@/components/charts/TradingViewChart";
import PortfolioWidget from "@/components/dashboard/PortfolioWidget";
import MarketTable from "@/components/market/MarketTable";
import AISignals from "@/components/dashboard/AISignals";
import MarketPulse from "@/components/dashboard/MarketPulse";
import MarketAnalytics from "@/components/analytics/MarketAnalytics";
import SignalPanel from "@/components/signals/SignalPanel";
import { marketCache } from "@/services/market/cache";
import { fetchHistoricalCandles } from "@/services/market/candles";
import { calculateAllIndicators } from "@/services/indicators";
import { calculateMarketAnalytics } from "@/services/analytics/analytics-engine";
import { useMarketStore } from "@/store/market/useMarketStore";

export default function DashboardShell() {
  const setSupportedSymbols = useDashboardStore((state) => state.setSupportedSymbols);
  const supportedSymbols = useDashboardStore((state) => state.supportedSymbols);

  // Initialize the Market Engine Hook (manages active symbol/timeframe calculations)
  useMarketEngine();

  // 1. Initialize supported symbols list from environment variables
  useEffect(() => {
    const envCoins = process.env.NEXT_PUBLIC_SUPPORTED_COINS;
    const coinsList = envCoins 
      ? envCoins.split(",").map(c => c.trim().toUpperCase()) 
      : ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
    
    setSupportedSymbols(coinsList);
  }, [setSupportedSymbols]);

  // 2. Fetch initial statistics and manage global watchlist WebSocket ticker streams
  useEffect(() => {
    if (supportedSymbols.length === 0) return;

    // Fetch initial REST data for all coins to populate immediately
    const loadInitialStats = async () => {
      try {
        console.log("[Dashboard] Fetching initial ticker data from Binance REST API...");
        const initialTickers = await fetch24hTickers(supportedSymbols);
        const store = useDashboardStore.getState();
        
        for (const [sym, ticker] of Object.entries(initialTickers)) {
          store.updateTicker(sym, ticker);
        }
      } catch (err) {
        console.error("[Dashboard] Failed to load initial REST tickers:", err);
      }

      // Pre-load candles, indicators and analytics for all watchlist coins in the background
      for (const sym of supportedSymbols) {
        try {
          const timeframe = useMarketStore.getState().timeframe || "15m";
          let candles = marketCache.get(sym, timeframe);
          if (!candles) {
            candles = await fetchHistoricalCandles(sym, timeframe, 200);
            marketCache.set(sym, timeframe, candles);
          }
          const indicators = calculateAllIndicators(candles);
          const analytics = calculateMarketAnalytics(sym, candles, indicators);
          useMarketStore.getState().setIndicatorsForSymbol(sym, indicators);
          useMarketStore.getState().setAnalyticsForSymbol(sym, analytics);
        } catch (err) {
          console.error(`[Dashboard] Failed loading indicators for background symbol ${sym}:`, err);
        }
      }
    };

    loadInitialStats();

    // Connect to WebSocket and subscribe to ticker streams for all supported symbols (for watchlist/table views)
    marketWsService.connect();
    const tickerStreams = supportedSymbols.map((sym) => `${sym.toLowerCase()}@ticker`);
    marketWsService.subscribe(tickerStreams);

    // Cleanup connection and subscription on unmount
    return () => {
      console.log("[Dashboard] Cleaning up global ticker streams...");
      marketWsService.unsubscribe(tickerStreams);
    };
  }, [supportedSymbols]);

  return (
    <div className="flex h-screen w-screen bg-background text-foreground overflow-hidden font-sans transition-colors duration-300">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Panel Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-background/95">
        {/* Top Navbar */}
        <Navbar />

        {/* Workspace Body */}
        <main className="flex-1 px-8 py-6 pb-16 space-y-6 min-h-0">
          {/* Top Row Cards */}
          <MarketCards />

          {/* Full Width TradingView Chart */}
          <div className="w-full">
            <TradingViewChart />
          </div>

          {/* Market Analytics Cards (positioned right under the chart) */}
          <div className="w-full">
            <MarketAnalytics />
          </div>

          {/* Bottom Widgets Grid (3-Column Layout, matching height alignment) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 py-5">
            {/* Column 1: Market Watchlist + Portfolio Status */}
            <div className="space-y-6 flex flex-col justify-between">
              <MarketTable />
              <PortfolioWidget />
            </div>

            {/* Column 2: AI Analytics + Real-time order book pulse */}
            <div className="space-y-6 flex flex-col justify-between">
              <AISignals />
              <MarketPulse />
            </div>

            {/* Column 3: Full Height Strategy Signal Log */}
            <div className="flex flex-col">
              <SignalPanel className="bg-card border border-border rounded-xl overflow-hidden flex flex-col h-[724px] shadow-sm hover:shadow-md transition-all" />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
