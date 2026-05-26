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

  const getChangeColor = (change: number | undefined) => {
    if (change === undefined) return "text-slate-400";
    return change >= 0 ? "text-green-500" : "text-red-500";
  };

  const getChangeSign = (change: number | undefined) => {
    if (change === undefined) return "";
    return change >= 0 ? "+" : "";
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {/* Wallet Balance */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex items-center justify-between">
        <div className="space-y-1">
          <span className="text-xs text-slate-400 font-medium uppercase tracking-wider block">
            Wallet Balance
          </span>
          <span className="text-lg font-bold text-white block">$24,580.00</span>
          <span className="text-[10px] text-slate-500 block">USDT Available</span>
        </div>
        <div className="p-3 bg-slate-800 rounded-full border border-slate-700 text-blue-400">
          <Wallet size={18} />
        </div>
      </div>

      {/* Portfolio Value */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex items-center justify-between">
        <div className="space-y-1">
          <span className="text-xs text-slate-400 font-medium uppercase tracking-wider block">
            Portfolio Value
          </span>
          <span className="text-lg font-bold text-white block">$58,124.90</span>
          <span className="text-[10px] text-green-500 block">+5.3% Daily Gain</span>
        </div>
        <div className="p-3 bg-slate-800 rounded-full border border-slate-700 text-green-400">
          <TrendingUp size={18} />
        </div>
      </div>

      {/* Active Asset WebSocket Info */}
      <div className="bg-slate-900 border border-blue-900/40 rounded-lg p-4 flex items-center justify-between col-span-1 lg:col-span-2">
        <div className="space-y-1 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
              {selectedSymbol} Realtime
            </span>
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white tracking-tight">
              ${formatPrice(ticker?.price)}
            </span>
            {ticker && (
              <span className={`text-xs font-semibold ${getChangeColor(ticker.priceChangePercent24h)}`}>
                {getChangeSign(ticker.priceChangePercent24h)}
                {ticker.priceChangePercent24h.toFixed(2)}%
              </span>
            )}
          </div>
          {ticker ? (
            <div className="flex gap-4 text-[10px] text-slate-500">
              <span>High: <b className="text-slate-300">${formatPrice(ticker.high24h)}</b></span>
              <span>Low: <b className="text-slate-300">${formatPrice(ticker.low24h)}</b></span>
              <span>Vol: <b className="text-slate-300">{ticker.volume24h.toLocaleString(undefined, { maximumFractionDigits: 0 })}</b></span>
            </div>
          ) : (
            <span className="text-[10px] text-slate-600 block">Connecting stream...</span>
          )}
        </div>
        <div className="p-3 bg-slate-800/80 rounded-full border border-slate-700 text-blue-500 hidden sm:block">
          <Activity size={18} />
        </div>
      </div>

      {/* AI Confidence */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex items-center justify-between">
        <div className="space-y-1">
          <span className="text-xs text-slate-400 font-medium uppercase tracking-wider block">
            AI Signal Confidence
          </span>
          <span className="text-lg font-bold text-blue-400 block">78%</span>
          <span className="text-[10px] text-slate-500 block">Bullish Breakout Indicator</span>
        </div>
        <div className="p-3 bg-slate-800 rounded-full border border-slate-700 text-purple-400">
          <Cpu size={18} />
        </div>
      </div>
    </div>
  );
}
