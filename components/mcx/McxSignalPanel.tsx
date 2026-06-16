"use client";

import React, { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Clock, ShieldAlert, Zap, RefreshCw } from "lucide-react";

interface McxSignal {
  id: string;
  symbol: string;
  direction: "BUY" | "SELL" | "HOLD";
  confidence: number;
  strategyId: string;
  strategyName: string;
  timeframe: string;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  timestamp: string;
}

interface McxSignalPanelProps {
  className?: string;
}

export default function McxSignalPanel({ className }: McxSignalPanelProps) {
  const [signals, setSignals] = useState<McxSignal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSignals = async () => {
    try {
      const res = await fetch("/api/mcx/signals");
      const data = await res.json();
      if (data && data.success) {
        setSignals(data.signals);
      }
    } catch (err) {
      console.warn("Failed to fetch MCX signals:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSignals();
    const interval = setInterval(fetchSignals, 10000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const diff = Date.now() - date.getTime();
    if (diff < 60000) return "Just now";
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  return (
    <div className={className || "bg-card border border-border rounded-xl overflow-hidden flex flex-col h-[350px] shadow-sm"}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 text-primary">
          <Zap size={16} />
          <h3 className="font-bold text-card-foreground text-sm uppercase tracking-wider">
            MCX Strategy Signals
          </h3>
        </div>
        <button
          onClick={fetchSignals}
          className="p-1 hover:bg-muted rounded transition-colors"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Signal List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {signals.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
            <ShieldAlert size={36} className="text-muted-foreground/45 mb-2 animate-bounce" />
            <span className="text-xs font-semibold uppercase tracking-wider block mb-1">
              No Signals Logged
            </span>
            <span className="text-[10px] text-muted-foreground/60 max-w-[200px] leading-relaxed">
              MCX strategies will trigger signals based on market price action.
            </span>
          </div>
        ) : (
          signals.map((sig) => {
            const isBuy = sig.direction === "BUY";
            return (
              <div 
                key={sig.id}
                className="bg-muted/10 border border-border/50 rounded-lg p-3 hover:bg-muted/20 transition-all group"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-md ${isBuy ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                      {isBuy ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-[11px] uppercase tracking-tight">{sig.symbol}</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                          {sig.timeframe}
                        </span>
                      </div>
                      <div className="text-[9px] font-medium text-muted-foreground">
                        {sig.strategyName}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-[10px] font-black uppercase ${isBuy ? 'text-green-500' : 'text-red-500'}`}>
                      {sig.direction === "BUY" ? "LONG ENTRY" : "SHORT ENTRY"}
                    </div>
                    <div className="flex items-center gap-1 text-[9px] text-muted-foreground justify-end">
                      <Clock size={10} />
                      {formatTime(sig.timestamp)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 border-t border-border/30 pt-2">
                  <div className="flex flex-col">
                    <span className="text-[8px] uppercase font-black text-muted-foreground">Entry</span>
                    <span className="text-[10px] font-bold tabular-nums">₹{sig.entryPrice.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[8px] uppercase font-black text-muted-foreground text-red-400">Stop</span>
                    <span className="text-[10px] font-bold tabular-nums">₹{sig.stopLoss.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[8px] uppercase font-black text-muted-foreground text-green-400">Target</span>
                    <span className="text-[10px] font-bold tabular-nums">₹{sig.takeProfit.toLocaleString("en-IN")}</span>
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <div className="h-1 flex-1 bg-secondary rounded-full overflow-hidden mr-3">
                    <div 
                      className={`h-full ${isBuy ? 'bg-green-500' : 'bg-red-500'}`} 
                      style={{ width: `${sig.confidence * 100}%` }}
                    />
                  </div>
                  <span className="text-[9px] font-black italic">{(sig.confidence * 100).toFixed(0)}%</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
