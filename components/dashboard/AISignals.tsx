"use client";

import React from "react";
import { useMarketStore } from "@/store/market/useMarketStore";
import { useDashboardStore } from "@/store/dashboard/useDashboardStore";
import { Cpu, TrendingUp, TrendingDown, ShieldAlert, Award } from "lucide-react";

export default function AISignals() {
  const selectedSymbol = useDashboardStore((state) => state.selectedSymbol);
  const candles = useMarketStore((state) => state.candles);
  const indicators = useMarketStore((state) => state.indicators);
  const analytics = useMarketStore((state) => state.analytics);
  const loading = useMarketStore((state) => state.loading);

  const cleanName = selectedSymbol.replace("USDT", "");

  // If loading or insufficient data, render skeleton/empty state
  if (loading || candles.length === 0 || !indicators || !analytics) {
    return (
      <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col h-[350px] shadow-sm animate-pulse">
        <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-muted rounded-full"></div>
            <div className="w-24 h-4 bg-muted rounded"></div>
          </div>
          <div className="w-16 h-3 bg-muted rounded"></div>
        </div>
        <div className="flex-1 p-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex justify-between">
              <div className="w-16 h-6 bg-muted rounded-lg"></div>
              <div className="w-24 h-6 bg-muted rounded-lg"></div>
            </div>
            <div className="h-14 bg-muted rounded-xl"></div>
            <div className="grid grid-cols-3 gap-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-12 bg-muted rounded-xl"></div>
              ))}
            </div>
          </div>
          <div className="h-4 bg-muted rounded w-1/3"></div>
        </div>
      </div>
    );
  }

  const lastIdx = candles.length - 1;
  const currentPrice = candles[lastIdx].close;
  const rsi = indicators.rsi[lastIdx] ?? 50;
  const atr = indicators.atr[lastIdx] ?? (currentPrice * 0.015);
  const trend = analytics.trendDirection;
  
  // 1. Determine Signal Direction dynamically
  let signalType: "LONG" | "SHORT" = "LONG";
  if (trend === "BEARISH") {
    signalType = "SHORT";
  } else if (rsi > 60) {
    signalType = "SHORT"; // Overbought reversal candidate
  } else if (rsi < 40) {
    signalType = "LONG";  // Oversold bounce candidate
  } else if (indicators.macdHist[lastIdx] < 0) {
    signalType = "SHORT";
  }

  // 2. Calculate dynamic targets based on ATR (Average True Range) for volatility adjusting
  const entry = currentPrice;
  let stopLoss = 0;
  let target = 0;

  if (signalType === "LONG") {
    stopLoss = currentPrice - 1.8 * atr;
    target = currentPrice + 3.2 * atr;
  } else {
    stopLoss = currentPrice + 1.8 * atr;
    target = currentPrice - 3.2 * atr;
  }

  // 3. Compute dynamic confidence score
  let confidence = 65; // Base confidence
  if (signalType === "LONG" && trend === "BULLISH") confidence += 15;
  if (signalType === "SHORT" && trend === "BEARISH") confidence += 15;
  if (rsi <= 30 && signalType === "LONG") confidence += 10;
  if (rsi >= 70 && signalType === "SHORT") confidence += 10;
  
  // Add minor check for MACD momentum alignment
  const macdHistLast = indicators.macdHist[lastIdx] ?? 0;
  const macdHistPrev = lastIdx > 0 ? (indicators.macdHist[lastIdx - 1] ?? 0) : 0;
  if (signalType === "LONG" && macdHistLast > macdHistPrev) confidence += 5;
  if (signalType === "SHORT" && macdHistLast < macdHistPrev) confidence += 5;

  confidence = Math.min(95, Math.max(45, confidence));

  // 4. Construct indicator-derived dynamic AI Status text
  const rsiExplanation = rsi >= 70
    ? `RSI indicates overbought conditions at ${rsi.toFixed(1)}.`
    : rsi <= 30
    ? `RSI indicates oversold conditions at ${rsi.toFixed(1)}.`
    : `RSI is neutral at ${rsi.toFixed(1)}.`;

  const macdExplanation = macdHistLast > macdHistPrev
    ? "MACD bullish momentum crossover is expanding."
    : "MACD bearish pressure is currently dominant.";

  const volatilityExplanation = analytics.volatilityScore === "HIGH"
    ? "Volatility is elevated, widening the ATR bounds."
    : analytics.volatilityScore === "LOW"
    ? "Volatility is low, signaling a price contraction squeeze."
    : "Volatility remains normal.";

  const trendExplanation = trend === "BULLISH"
    ? "Bullish trend verified above SMA(20)."
    : trend === "BEARISH"
    ? "Bearish trend verified below SMA(20)."
    : "Trend is ranging sideways.";

  const dynamicStatus = `${rsiExplanation} ${macdExplanation} ${trendExplanation} ${volatilityExplanation} Dynamic Target is placed at $${target.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} with dynamic ATR Stop Loss protection.`;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col h-[350px] shadow-sm hover:shadow-md transition-all">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 text-primary">
          <Cpu size={16} />
          <h3 className="font-bold text-card-foreground text-sm uppercase tracking-wider">
            Synapse AI Analytics
          </h3>
        </div>
        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest animate-pulse">
          Engine Live
        </span>
      </div>

      <div className="flex-1 p-5 flex flex-col justify-between overflow-y-auto custom-scrollbar">
        <div className="space-y-4">
          {/* Signal Header Type */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {signalType === "LONG" ? (
                <span className="flex items-center gap-1 bg-green-500/10 text-green-500 text-xs font-black px-2.5 py-1 rounded-lg border border-green-500/20 shadow-sm shadow-green-500/5">
                  <TrendingUp size={12} />
                  LONG
                </span>
              ) : (
                <span className="flex items-center gap-1 bg-red-500/10 text-red-500 text-xs font-black px-2.5 py-1 rounded-lg border border-red-500/20 shadow-sm shadow-red-500/5">
                  <TrendingDown size={12} />
                  SHORT
                </span>
              )}
              <span className="text-sm font-bold text-foreground">{cleanName}</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-semibold bg-primary/5 px-2 py-1 rounded-md border border-primary/10">
              <Award size={14} className="text-primary" />
              <span>Confidence: <b className="text-primary font-bold">{confidence}%</b></span>
            </div>
          </div>

          {/* Status Message */}
          <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-xl border border-border/50 leading-relaxed shadow-inner">
            &quot;{dynamicStatus}&quot;
          </div>

          {/* Pricing Parameters */}
          <div className="grid grid-cols-3 gap-3 pt-1 text-center">
            <div className="bg-muted/30 p-2.5 rounded-xl border border-border/50 group hover:border-primary/30 transition-colors">
              <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest block mb-1">Entry</span>
              <span className="text-xs font-bold font-mono text-foreground block group-hover:text-primary transition-colors">
                ${entry.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="bg-muted/30 p-2.5 rounded-xl border border-border/50 group hover:border-green-500/30 transition-colors">
              <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest block mb-1">Target</span>
              <span className="text-xs font-bold font-mono text-green-500 block">
                ${target.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="bg-muted/30 p-2.5 rounded-xl border border-border/50 group hover:border-red-500/30 transition-colors">
              <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest block mb-1">Stop Loss</span>
              <span className="text-xs font-bold font-mono text-red-500 block">
                ${stopLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="border-t border-border pt-4 mt-2 flex items-center justify-between text-[10px] text-muted-foreground font-medium uppercase tracking-tight shrink-0">
          <div className="flex items-center gap-1.5">
            <ShieldAlert size={12} className="text-muted-foreground/60" />
            <span>Indicator Derived Analytics</span>
          </div>
          <span className="bg-muted px-2 py-0.5 rounded-full border border-border/50">
            Realtime
          </span>
        </div>
      </div>
    </div>
  );
}
