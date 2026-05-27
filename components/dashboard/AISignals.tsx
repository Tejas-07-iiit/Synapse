"use client";

import React from "react";
import { useMarketStore } from "@/src/stores/marketStore";
import { useSignalStore } from "@/src/stores/signalStore";
import { Cpu, TrendingUp, TrendingDown, ShieldAlert, Award, AlertCircle } from "lucide-react";

export default function AISignals() {
  const selectedSymbol = useMarketStore((state) => state.selectedSymbol);
  const candles = useMarketStore((state) => state.candles);
  const loading = useMarketStore((state) => state.loading);
  const activeSignals = useSignalStore((state) => state.activeSignals);

  const cleanName = selectedSymbol.replace("USDT", "");

  // If loading or no candles, render skeleton
  if (loading || candles.length === 0) {
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

  // Get the most recent signal for the active symbol
  const latestSignal = activeSignals.find(
    (s) => s.symbol.toUpperCase() === selectedSymbol.toUpperCase()
  );

  const currentPrice = candles[candles.length - 1].close;

  // Setup default scanner states if no strategy signals have triggered yet
  const signalType = latestSignal ? latestSignal.signal : "HOLD";
  const confidence = latestSignal ? latestSignal.confidence : 0;
  const entry = latestSignal ? latestSignal.entry : currentPrice;
  const stopLoss = latestSignal ? latestSignal.stopLoss : 0;
  const takeProfit = latestSignal ? latestSignal.takeProfit : 0;

  const reasoningString = latestSignal && latestSignal.reasoning.length > 0
    ? latestSignal.reasoning.join(" ")
    : `System scanning: Monitoring ${selectedSymbol} price action across active crossovers, reversals, breakout bands, and momentum metrics. No active signals triggered yet.`;

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
              {signalType === "LONG" && (
                <span className="flex items-center gap-1 bg-green-500/10 text-green-500 text-xs font-black px-2.5 py-1 rounded-lg border border-green-500/20 shadow-sm shadow-green-500/5">
                  <TrendingUp size={12} />
                  LONG
                </span>
              )}
              {signalType === "SHORT" && (
                <span className="flex items-center gap-1 bg-red-500/10 text-red-500 text-xs font-black px-2.5 py-1 rounded-lg border border-red-500/20 shadow-sm shadow-red-500/5">
                  <TrendingDown size={12} />
                  SHORT
                </span>
              )}
              {signalType === "HOLD" && (
                <span className="flex items-center gap-1 bg-muted/55 text-muted-foreground text-xs font-black px-2.5 py-1 rounded-lg border border-border">
                  <AlertCircle size={12} />
                  HOLD
                </span>
              )}
              <span className="text-sm font-bold text-foreground">{cleanName}</span>
            </div>
            
            {signalType !== "HOLD" && (
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-semibold bg-primary/5 px-2 py-1 rounded-md border border-primary/10">
                <Award size={14} className="text-primary" />
                <span>Confidence: <b className="text-primary font-bold">{confidence}%</b></span>
              </div>
            )}
          </div>

          {/* Status Message */}
          <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-xl border border-border/50 leading-relaxed shadow-inner">
            &quot;{reasoningString}&quot;
          </div>

          {/* Pricing Parameters */}
          {signalType !== "HOLD" && (
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
                  ${takeProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="bg-muted/30 p-2.5 rounded-xl border border-border/50 group hover:border-red-500/30 transition-colors">
                <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest block mb-1">Stop Loss</span>
                <span className="text-xs font-bold font-mono text-red-500 block">
                  ${stopLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="border-t border-border pt-4 mt-2 flex items-center justify-between text-[10px] text-muted-foreground font-medium uppercase tracking-tight shrink-0">
          <div className="flex items-center gap-1.5">
            <ShieldAlert size={12} className="text-muted-foreground/60" />
            <span>Real Modular Strategy Engine</span>
          </div>
          <span className="bg-muted px-2 py-0.5 rounded-full border border-border/50">
            Realtime
          </span>
        </div>
      </div>
    </div>
  );
}
