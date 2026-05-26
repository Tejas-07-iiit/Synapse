"use client";

import React, { useEffect } from "react";
import { useDashboardStore } from "@/store/dashboard/useDashboardStore";
import { wsService } from "@/services/websocket/websocketManager";
import { fetch24hTickers } from "@/services/binance/binance";
import Sidebar from "@/components/sidebar/Sidebar";
import Navbar from "@/components/navbar/Navbar";
import MarketCards from "@/components/dashboard/MarketCards";
import TradingViewChart from "@/components/charts/TradingViewChart";
import PortfolioWidget from "@/components/dashboard/PortfolioWidget";
import MarketTable from "@/components/market/MarketTable";
import AISignals from "@/components/dashboard/AISignals";
import MarketPulse from "@/components/dashboard/MarketPulse";

export default function DashboardShell() {
  const setSupportedSymbols = useDashboardStore((state) => state.setSupportedSymbols);
  const supportedSymbols = useDashboardStore((state) => state.supportedSymbols);

  // 1. Initialize supported symbols list from environment variables
  useEffect(() => {
    const envCoins = process.env.NEXT_PUBLIC_SUPPORTED_COINS;
    const coinsList = envCoins 
      ? envCoins.split(",").map(c => c.trim().toUpperCase()) 
      : ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
    
    setSupportedSymbols(coinsList);
  }, [setSupportedSymbols]);

  // 2. Fetch initial statistics and manage WebSocket lifecycle
  useEffect(() => {
    if (supportedSymbols.length === 0) return;

    // Fetch initial REST data for all coins to populate immediately
    const loadInitialStats = async () => {
      try {
        console.log("Fetching initial ticker data from Binance REST API...");
        const initialTickers = await fetch24hTickers(supportedSymbols);
        const store = useDashboardStore.getState();
        
        for (const [sym, ticker] of Object.entries(initialTickers)) {
          store.updateTicker(sym, ticker);
        }
      } catch (err) {
        console.error("Failed to load initial REST tickers:", err);
      }
    };

    loadInitialStats();

    // Connect to WebSocket and subscribe to ticker streams
    wsService.connect();
    wsService.subscribe(supportedSymbols);

    // Cleanup connection and subscription on unmount
    return () => {
      console.log("Cleaning up WebSocket client dashboard shell...");
      wsService.unsubscribe(supportedSymbols);
      wsService.disconnect();
    };
  }, [supportedSymbols]);

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Panel Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
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

          {/* Bottom Widgets Grid (2x2 Layout to prevent data crowding) */}
          <div className="grid grid-cols-1 py-5 lg:grid-cols-2 gap-6">
            <MarketTable />
            <AISignals />
            <PortfolioWidget />
            <MarketPulse />
          </div>
        </main>
      </div>
    </div>
  );
}
