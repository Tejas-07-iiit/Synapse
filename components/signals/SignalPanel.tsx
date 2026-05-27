"use client";

import React from "react";
import { useSignalStore } from "@/src/stores/signalStore";
import { TrendingUp, TrendingDown, Clock, ShieldAlert, Zap } from "lucide-react";

interface SignalPanelProps {
  className?: string;
}

export default function SignalPanel({ className }: SignalPanelProps) {
  const activeSignals = useSignalStore((state) => state.activeSignals);
  const clearSignals = useSignalStore((state) => state.clearSignals);

  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return "Just now";
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const getStrategyName = (strategyId: string) => {
    if (strategyId === "ema-crossover") return "EMA Crossover Strategy";
    if (strategyId === "rsi-reversal") return "RSI Reversal Strategy";
    if (strategyId === "macd-momentum") return "MACD Momentum Strategy";
    if (strategyId === "bollinger-breakout") return "Bollinger Breakout Strategy";
    return strategyId.toUpperCase();
  };

  return (
    <div className={className || "bg-card border border-border rounded-xl overflow-hidden flex flex-col h-[350px] shadow-sm"}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 text-primary">
          <Zap size={16} />
          <h3 className="font-bold text-card-foreground text-sm uppercase tracking-wider">
            Strategy Engine Output Log
          </h3>
        </div>
        <button
          onClick={clearSignals}
          className="text-[10px] text-muted-foreground hover:text-foreground font-bold uppercase tracking-widest px-2 py-0.5 border border-border hover:border-muted-foreground rounded transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Signal List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {activeSignals.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
            <ShieldAlert size={36} className="text-muted-foreground/45 mb-2 animate-bounce" />
            <span className="text-xs font-semibold uppercase tracking-wider block mb-1">
              No Signals Logged
            </span>
            <span className="text-[10px] text-muted-foreground/60 max-w-[200px] leading-relaxed">
              Active strategies will trigger signal contracts on incoming market price ticks.
            </span>
          </div>
        ) : (
          activeSignals.map((sig, idx) => {
            const cleanSymbol = sig.symbol.replace("USDT", "");
            const isLong = sig.signal === "LONG";
            const isShort = sig.signal === "SHORT";

            return (
              <div
                key={`${sig.strategyId}_${sig.symbol}_${sig.timestamp}_${idx}`}
                className="bg-muted/30 border border-border hover:border-primary/20 rounded-xl p-3 space-y-2 hover:bg-muted/50 transition-all shadow-inner"
              >
                {/* Upper line */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-xs text-foreground tracking-tight">
                      {cleanSymbol}
                    </span>
                    <span className="text-[9px] font-bold bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded uppercase">
                      {sig.timeframe}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-medium truncate max-w-[120px] md:max-w-[180px]">
                      {getStrategyName(sig.strategyId)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {isLong && (
                      <span className="flex items-center gap-0.5 bg-green-500/10 text-green-500 text-[10px] font-extrabold px-2 py-0.5 rounded border border-green-500/20">
                        <TrendingUp size={10} />
                        LONG
                      </span>
                    )}
                    {isShort && (
                      <span className="flex items-center gap-0.5 bg-red-500/10 text-red-500 text-[10px] font-extrabold px-2 py-0.5 rounded border border-red-500/20">
                        <TrendingDown size={10} />
                        SHORT
                      </span>
                    )}
                    {sig.signal === "HOLD" && (
                      <span className="bg-muted text-muted-foreground text-[10px] font-extrabold px-2 py-0.5 rounded border border-border">
                        HOLD
                      </span>
                    )}
                  </div>
                </div>

                {/* Reasoning text */}
                <div className="text-[11px] text-muted-foreground leading-relaxed pl-1 border-l-2 border-primary/15">
                  {sig.reasoning.join(" ")}
                </div>

                {/* Footer time */}
                <div className="flex items-center justify-between text-[9px] text-muted-foreground/60 pt-1 border-t border-border/40">
                  <span>Price: ${sig.entry.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <div className="flex items-center gap-1">
                    <Clock size={10} />
                    <span>{formatTime(sig.timestamp)}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
