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
    if (strategyId === "mean-reversion") return "Mean Reversion Strategy";
    if (strategyId === "momentum") return "Momentum Strategy";
    if (strategyId === "defensive") return "Defensive Strategy";
    if (strategyId === "grid") return "Grid Strategy";
    if (strategyId === "lorentzian") return "Lorentzian Classification";
    if (strategyId === "donchian-breakout") return "Donchian Breakout Strategy";
    if (strategyId === "rally-base-drop") return "Rally Base Drop Strategy";
    if (strategyId === "sr-sweep") return "SR Sweep Strategy";
    if (strategyId === "bollinger-reversion") return "Bollinger Reversion Strategy";
    if (strategyId === "short-term-reversal") return "Short Term Reversal Strategy";
    if (strategyId === "dow-mfi-rsi") return "Dow Factor MFI RSI Strategy";
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
                    {sig.blocked && (
                      <span className="bg-amber-500/10 text-amber-500 text-[9px] font-black px-2 py-0.5 rounded border border-amber-500/20 flex items-center gap-1.5">
                        <span className="w-1 h-1 bg-amber-500 rounded-full animate-pulse"></span>
                        BLOCKED
                      </span>
                    )}
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

                 {/* Advanced Market Context Metrics */}
                <div className="flex flex-wrap gap-1.5 py-1">
                  {/* Confidence Score */}
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                    sig.confidence >= 75
                      ? "bg-green-500/10 text-green-400 border-green-500/25"
                      : sig.confidence >= 50
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/25"
                      : "bg-muted text-muted-foreground border-border"
                  }`}>
                    {sig.confidence}% Confidence
                  </span>

                  {/* Market Regime Category */}
                  {sig.marketContext?.regimeCategory && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                      sig.marketContext.regimeCategory === "TRENDING"
                        ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/25"
                        : sig.marketContext.regimeCategory === "BREAKOUT"
                        ? "bg-rose-500/10 text-rose-400 border-rose-500/25"
                        : sig.marketContext.regimeCategory === "LIQUIDITY_SWEEP"
                        ? "bg-purple-500/10 text-purple-400 border-purple-500/25"
                        : sig.marketContext.regimeCategory === "ACCUMULATION"
                        ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/25"
                        : sig.marketContext.regimeCategory === "DISTRIBUTION"
                        ? "bg-orange-500/10 text-orange-400 border-orange-500/25"
                        : "bg-amber-500/10 text-amber-400 border-amber-500/25" // RANGING
                    }`}>
                      {sig.marketContext.regimeCategory} ({sig.marketContext.regime})
                    </span>
                  )}

                  {/* Lorentzian Probability / Similarity */}
                  {sig.strategyId === "lorentzian" && sig.marketContext?.probability !== undefined && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/25 rounded animate-pulse">
                      Prob: {sig.marketContext.probability.toFixed(1)}%
                    </span>
                  )}

                  {/* Bollinger Breakout Strength */}
                  {sig.strategyId === "bollinger-breakout" && sig.marketContext?.breakoutStrength && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 bg-pink-500/10 text-pink-400 border border-pink-500/25 rounded">
                      Breakout: {(sig.marketContext.breakoutStrength.bodyRatio * 100).toFixed(0)}% (Vol {(sig.marketContext.breakoutStrength.volumeRatio).toFixed(1)}x)
                    </span>
                  )}

                  {/* Donchian Breakout Strength */}
                  {sig.strategyId === "donchian-breakout" && sig.marketContext?.breakoutStrength && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 bg-pink-500/10 text-pink-400 border border-pink-500/25 rounded">
                      Donchian Breakout: {(sig.marketContext.breakoutStrength.bodyRatio * 100).toFixed(0)}% (Vol {(sig.marketContext.breakoutStrength.volumeRatio).toFixed(1)}x)
                    </span>
                  )}

                  {/* Rally Base Drop Zone */}
                  {sig.strategyId === "rally-base-drop" && sig.marketContext?.zoneData && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 border rounded ${
                      sig.marketContext.zoneData.type === "SUPPLY"
                        ? "bg-red-500/10 text-red-400 border-red-500/25"
                        : "bg-green-500/10 text-green-400 border-green-500/25"
                    }`}>
                      Zone: {sig.marketContext.zoneData.type} (${sig.marketContext.zoneData.low.toFixed(1)}-${sig.marketContext.zoneData.high.toFixed(1)})
                    </span>
                  )}

                  {/* SR Sweep Metadata */}
                  {sig.strategyId === "sr-sweep" && sig.marketContext?.sweepMetadata && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 rounded">
                      Sweep: ${sig.marketContext.sweepMetadata.sweepPrice.toFixed(1)} (RSI {sig.marketContext.sweepMetadata.rsi.toFixed(1)})
                    </span>
                  )}

                  {/* Grid Range Width / Midpoint Proximity */}
                  {sig.strategyId === "grid" && sig.marketContext?.volatilityState?.currentWidth !== undefined && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/25 rounded">
                      Range Width: {(sig.marketContext.volatilityState.currentWidth * 100).toFixed(2)}%
                    </span>
                  )}

                  {/* Bollinger Reversion */}
                  {sig.strategyId === "bollinger-reversion" && sig.marketContext?.volatilityState?.currentWidth !== undefined && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/25 rounded">
                      BB Reversion: {(sig.marketContext.volatilityState.currentWidth * 100).toFixed(2)}% Width
                    </span>
                  )}

                  {/* Short Term Reversal */}
                  {sig.strategyId === "short-term-reversal" && sig.marketContext?.momentum !== undefined && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 rounded">
                      Mom12: {Number(sig.marketContext.momentum).toFixed(2)}
                    </span>
                  )}

                  {/* Dow Factor MFI RSI */}
                  {sig.strategyId === "dow-mfi-rsi" && sig.marketContext?.dowStructure && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/25 rounded">
                      Dow: {sig.marketContext.dowStructure} (MFI {Number(sig.marketContext.mfi || 50).toFixed(0)})
                    </span>
                  )}
                </div>

                {/* Reasoning text */}
                <div className="text-[11px] text-muted-foreground leading-relaxed pl-1 border-l-2 border-primary/15">
                  {sig.reasoning.join(" ")}
                  {sig.blocked && (
                    <div className="mt-1 text-[10px] font-semibold text-amber-400 flex flex-wrap items-center gap-1 bg-amber-500/5 border border-amber-500/10 p-1.5 rounded-lg">
                      <span>ACTIVE POSITION EXISTS: Trade execution locked for {sig.symbol}</span>
                      {sig.activePositionId && (
                        <span className="text-[9px] text-muted-foreground font-mono font-normal bg-muted px-1.5 py-0.5 rounded">(ID: {sig.activePositionId.slice(0, 8)}...)</span>
                      )}
                    </div>
                  )}
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
