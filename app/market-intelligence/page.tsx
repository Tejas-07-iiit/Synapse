"use client";

import React from "react";
import Sidebar from "@/components/sidebar/Sidebar";
import Navbar from "@/components/navbar/Navbar";
import { useMarketEngine } from "@/hooks/market/useMarketEngine";
import { useDashboardStore } from "@/store/dashboard/useDashboardStore";
import { useMarketStore } from "@/store/market/useMarketStore";
import MarketScore from "@/components/market/market-score";
import MarketSummary from "@/components/market/market-summary";
import TrendCard from "@/components/market/trend-card";
import MomentumCard from "@/components/market/momentum-card";
import VolatilityCard from "@/components/market/volatility-card";
import RegimeCard from "@/components/market/regime-card";
import IndicatorTable from "@/components/market/indicator-table";
import { Brain, RefreshCw, AlertCircle } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import TradingLoader from "@/components/TradingLoader";

export default function MarketIntelligencePage() {
  const { symbol, timeframe, indicators, analytics, loading, error } = useMarketEngine();
  const tickerData = useDashboardStore((state) => state.tickerData);
  const activeTicker = symbol ? tickerData[symbol] : undefined;
  
  const setTimeframe = useMarketStore((state) => state.setTimeframe);
  const { isLoading: authLoading } = useAuthStore();

  const cleanSymbol = symbol ? symbol.replace("USDT", "") : "";

  return (
    <>
      <TradingLoader loading={authLoading || (loading && !analytics)} />
      <div className="flex h-screen w-screen bg-background text-foreground overflow-hidden font-sans transition-colors duration-300">
        {/* Sidebar Navigation */}
        <Sidebar />

      {/* Main Panel Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-background/95">
        {/* Top Navbar */}
        <Navbar />

        {/* Intelligence Workspace Body */}
        <main className="flex-1 px-8 py-6 pb-16 space-y-6 min-h-0">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-inner">
                <Brain className="text-primary animate-pulse" size={22} />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight text-foreground uppercase">
                  Market Intelligence Terminal
                </h1>
                <p className="text-xs text-muted-foreground">
                  Quantitative signals, regime classifiers, and indicator analytics for {cleanSymbol}.
                </p>
              </div>
            </div>

            {/* Timeframe Controls (Strictly 5m and 15m only) */}
            <div className="flex items-center gap-1.5 bg-secondary/60 border border-border p-1 rounded-xl shadow-inner self-start sm:self-center">
              {(["5m", "15m"] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg transition duration-200 ${
                    timeframe === tf
                      ? "bg-card text-foreground shadow border border-border"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          {/* Loading and Error States */}
          {loading && !analytics && (
            <div className="flex flex-col items-center justify-center h-[400px] gap-3">
              <RefreshCw className="animate-spin text-primary" size={32} />
              <span className="text-sm text-muted-foreground font-semibold">Running indicator and regime analytics...</span>
            </div>
          )}

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-xl p-4 flex items-center gap-3">
              <AlertCircle size={20} />
              <div>
                <h4 className="text-sm font-bold">Calculation Error</h4>
                <p className="text-xs">{error}</p>
              </div>
            </div>
          )}

          {analytics && (
            <div className="space-y-6">
              {/* Top Row: Score + Natural Language Summary */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div>
                  <MarketScore score={analytics.marketScore} />
                </div>
                <div className="lg:col-span-2">
                  <MarketSummary summary={analytics.summary} symbol={symbol} />
                </div>
              </div>

              {/* Grid of 4 Intelligence Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                <TrendCard analytics={analytics} />
                <MomentumCard analytics={analytics} />
                <VolatilityCard analytics={analytics} />
                <RegimeCard analytics={analytics} />
              </div>

              {/* Indicator Details Table */}
              <div className="pt-2">
                <IndicatorTable indicators={indicators || undefined} ticker={activeTicker} />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
    </>
  );
}
