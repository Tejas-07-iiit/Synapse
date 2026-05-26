"use client";

import React from "react";
import { useDashboardStore } from "@/store/dashboard/useDashboardStore";
import { Cpu, TrendingUp, TrendingDown, ShieldAlert, Award } from "lucide-react";
import { AISignal } from "@/types/market";

const mockSignals: Record<string, AISignal> = {
  BTCUSDT: {
    symbol: "BTCUSDT",
    type: "LONG",
    entry: 96500,
    target: 104200,
    stopLoss: 93100,
    confidence: 78,
    status: "Monitoring breakout above resistance.",
    timestamp: "Just now",
  },
  ETHUSDT: {
    symbol: "ETHUSDT",
    type: "LONG",
    entry: 3420,
    target: 3850,
    stopLoss: 3250,
    confidence: 82,
    status: "Retesting major support level.",
    timestamp: "12m ago",
  },
  SOLUSDT: {
    symbol: "SOLUSDT",
    type: "SHORT",
    entry: 142.5,
    target: 128.0,
    stopLoss: 151.0,
    confidence: 64,
    status: "Overbought on daily RSI, bearish divergence.",
    timestamp: "1h ago",
  },
};

export default function AISignals() {
  const selectedSymbol = useDashboardStore((state) => state.selectedSymbol);
  
  // Get active signal or fallback to generic
  const signal = mockSignals[selectedSymbol] || {
    symbol: selectedSymbol,
    type: "LONG",
    entry: 100.0,
    target: 110.0,
    stopLoss: 95.0,
    confidence: 50,
    status: "Consolidating. Awaiting breakout signals.",
    timestamp: "Updated",
  };

  const cleanName = selectedSymbol.replace("USDT", "");

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex flex-col h-[350px]">
      <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/85 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 text-blue-400">
          <Cpu size={16} />
          <h3 className="font-bold text-white text-sm">Synapse AI Signals</h3>
        </div>
        <span className="text-[10px] text-slate-500 font-mono">Verifying patterns</span>
      </div>

      <div className="flex-1 p-5 flex flex-col justify-between overflow-y-auto">
        <div className="space-y-4">
          {/* Signal Header Type */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {signal.type === "LONG" ? (
                <span className="flex items-center gap-1 bg-green-950 text-green-400 text-xs font-black px-2.5 py-1 rounded border border-green-900/40">
                  <TrendingUp size={12} />
                  LONG
                </span>
              ) : (
                <span className="flex items-center gap-1 bg-red-950 text-red-400 text-xs font-black px-2.5 py-1 rounded border border-red-900/40">
                  <TrendingDown size={12} />
                  SHORT
                </span>
              )}
              <span className="text-sm font-bold text-white">{cleanName}</span>
            </div>
            <div className="flex items-center gap-1 text-slate-400 text-xs">
              <Award size={14} className="text-blue-400" />
              <span>Conf: <b>{signal.confidence}%</b></span>
            </div>
          </div>

          {/* Status Message */}
          <p className="text-xs text-slate-400 bg-slate-850 p-2.5 rounded border border-slate-800 leading-relaxed">
            {signal.status}
          </p>

          {/* Pricing Parameters */}
          <div className="grid grid-cols-3 gap-2 pt-1 text-center">
            <div className="bg-slate-950/50 p-2 rounded border border-slate-800/40">
              <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider block">Entry</span>
              <span className="text-xs font-bold font-mono text-white mt-1 block">
                ${signal.entry.toLocaleString()}
              </span>
            </div>
            <div className="bg-slate-950/50 p-2 rounded border border-slate-800/40">
              <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider block">Target</span>
              <span className="text-xs font-bold font-mono text-green-400 mt-1 block">
                ${signal.target.toLocaleString()}
              </span>
            </div>
            <div className="bg-slate-950/50 p-2 rounded border border-slate-800/40">
              <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider block">Stop Loss</span>
              <span className="text-xs font-bold font-mono text-red-400 mt-1 block">
                ${signal.stopLoss.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="border-t border-slate-850 pt-4 flex items-center justify-between text-[10px] text-slate-500 shrink-0">
          <div className="flex items-center gap-1">
            <ShieldAlert size={12} className="text-slate-500" />
            <span>Educational mockup alerts only</span>
          </div>
          <span>{signal.timestamp}</span>
        </div>
      </div>
    </div>
  );
}
