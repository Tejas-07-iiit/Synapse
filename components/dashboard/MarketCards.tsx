"use client";

import React from "react";
import { useDashboardStore } from "@/store/dashboard/useDashboardStore";
import { Wallet, TrendingUp, Cpu, Activity } from "lucide-react";

export default function MarketCards() {
  const selectedSymbol = useDashboardStore((state) => state.selectedSymbol);
  const ticker = useDashboardStore((state) => state.tickerData[selectedSymbol]);

  const formatPrice = (price: number | undefined) => {
    if (price === undefined) return "Loading...";
    return price.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  };

  const getChangeSign = (change: number | undefined) => {
    if (change === undefined) return "";
    return change >= 0 ? "+" : "";
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {/* Wallet Balance */}
      <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
        <div className="space-y-1">
          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest block">
            Wallet Balance
          </span>
          <span className="text-lg font-bold text-foreground block">$10000.00</span>
          <span className="text-[10px] text-muted-foreground/60 block font-medium uppercase tracking-tight">USDT Available</span>
        </div>
        <div className="p-3 bg-primary/10 rounded-xl border border-primary/20 text-primary shadow-inner">
          <Wallet size={18} />
        </div>
      </div>

      {/* Portfolio Value */}
      <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
        <div className="space-y-1">
          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest block">
            Portfolio Value
          </span>
          <span className="text-lg font-bold text-foreground block">$10000.90</span>
          <span className="text-[10px] text-green-500 font-bold block uppercase tracking-tight">+1.3% Daily Gain</span>
        </div>
        <div className="p-3 bg-green-500/10 rounded-xl border border-green-500/20 text-green-500 shadow-inner">
          <TrendingUp size={18} />
        </div>
      </div>

      {/* Active Asset WebSocket Info */}
      <div className="bg-card border border-primary/30 rounded-xl p-4 flex items-center justify-between col-span-1 lg:col-span-2 shadow-sm hover:shadow-md transition-shadow ring-1 ring-primary/5">
        <div className="space-y-1 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
              {selectedSymbol} Realtime
            </span>
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-foreground tracking-tight">
              ${formatPrice(ticker?.price)}
            </span>
            {ticker && (
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${ticker.priceChangePercent24h >= 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                {getChangeSign(ticker.priceChangePercent24h)}
                {ticker.priceChangePercent24h.toFixed(2)}%
              </span>
            )}
          </div>
          {ticker ? (
            <div className="flex gap-4 text-[10px] text-muted-foreground font-medium uppercase tracking-tight">
              <span>High: <b className="text-foreground font-bold">${formatPrice(ticker.high24h)}</b></span>
              <span>Low: <b className="text-foreground font-bold">${formatPrice(ticker.low24h)}</b></span>
              <span>Vol: <b className="text-foreground font-bold">{ticker.volume24h.toLocaleString(undefined, { maximumFractionDigits: 0 })}</b></span>
            </div>
          ) : (
            <span className="text-[10px] text-muted-foreground/50 block animate-pulse">Connecting stream...</span>
          )}
        </div>
        <div className="p-3 bg-primary/10 rounded-xl border border-primary/20 text-primary shadow-inner hidden sm:block">
          <Activity size={18} />
        </div>
      </div>

      {/* AI Confidence */}
      <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
        <div className="space-y-1">
          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest block">
            AI Confidence
          </span>
          <span className="text-lg font-bold text-primary block">77%</span>
          <span className="text-[10px] text-muted-foreground/60 block font-medium uppercase tracking-tight">Breakout Indicator</span>
        </div>
        <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20 text-purple-500 shadow-inner">
          <Cpu size={18} />
        </div>
      </div>
    </div>
  );
}
