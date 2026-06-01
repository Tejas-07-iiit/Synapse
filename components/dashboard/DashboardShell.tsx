"use client";

import React, { useEffect } from "react";
import { useMarketEngine } from "@/hooks/market/useMarketEngine";
import { fetch24hTickers } from "@/services/market/ticker";
import Sidebar from "@/components/sidebar/Sidebar";
import Navbar from "@/components/navbar/Navbar";
import MarketCards from "@/components/dashboard/MarketCards";
import TradingViewChart from "@/components/charts/TradingViewChart";
import MarketTable from "@/components/market/MarketTable";
import MarketAnalytics from "@/components/analytics/MarketAnalytics";
import SignalPanel from "@/components/signals/SignalPanel";
import { useMarketStore } from "@/src/stores/marketStore";
import { TickerInfo } from "@/src/strategy-engine/types";
import { useAuthStore } from "@/store/useAuthStore";
import { useSettingsStore } from "@/src/stores/settingsStore";
import { useWalletStore } from "@/src/stores/walletStore";
import TradingLoader from "@/components/TradingLoader";

export default function DashboardShell() {
  const setSupportedSymbols = useMarketStore((state) => state.setSupportedSymbols);
  const supportedSymbols = useMarketStore((state) => state.supportedSymbols);

  const fetchSettings = useSettingsStore((state) => state.fetchSettings);
  const fetchWallet = useWalletStore((state) => state.fetchWallet);
  const user = useAuthStore((state) => state.user);
  const authLoading = useAuthStore((state) => state.isLoading);
  const settingsLoading = useSettingsStore((state) => state.loading);
  const walletLoading = useWalletStore((state) => state.loading);

  // Load user settings and wallet on mount / user change
  useEffect(() => {
    if (user?.id) {
      fetchSettings(user.id).catch(() => {});
      fetchWallet(user.id).catch(() => {});
    }
  }, [user?.id, fetchSettings, fetchWallet]);

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

  // 2. Fetch initial statistics
  useEffect(() => {
    if (supportedSymbols.length === 0) return;

    // Fetch initial REST data for all coins to populate immediately
    const loadInitialStats = async () => {
      try {
        console.log("[Dashboard] Fetching initial ticker data from Binance REST API...");
        const initialTickers = await fetch24hTickers(supportedSymbols);
        const store = useMarketStore.getState();
        
        for (const [sym, ticker] of Object.entries(initialTickers)) {
          store.updateTicker(sym, ticker as unknown as TickerInfo);
        }
      } catch (err) {
        console.error("[Dashboard] Failed to load initial REST tickers:", err);
      }
    };

    loadInitialStats();
  }, [supportedSymbols]);

  return (
    <>
      <TradingLoader loading={authLoading || settingsLoading || walletLoading} />
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

            {/* Bottom Widgets Grid (2-Column Layout) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-5">
              {/* Column 1: Market Watchlist */}
              <div className="flex flex-col">
                <MarketTable />
              </div>

              {/* Column 2: Full Height Strategy Signal Log */}
              <div className="flex flex-col">
                <SignalPanel className="bg-card border border-border rounded-xl overflow-hidden flex flex-col h-[724px] shadow-sm hover:shadow-md transition-all" />
              </div>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
