"use client";

import React from "react";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";
import { MarketAnalytics } from "@/types/market";

interface TrendCardProps {
  analytics: MarketAnalytics;
}

export default function TrendCard({ analytics }: TrendCardProps) {
  const getTrendConfig = (val: string) => {
    switch (val) {
      case "BULLISH":
        return {
          color: "text-green-500 bg-green-500/10 border-green-500/20",
          icon: <TrendingUp size={16} />,
          text: "Bullish Trend",
          desc: "Price is trading above the EMA(20) and SMA(50) averages.",
        };
      case "BEARISH":
        return {
          color: "text-red-500 bg-red-500/10 border-red-500/20",
          icon: <TrendingDown size={16} />,
          text: "Bearish Trend",
          desc: "Price is trading below the EMA(20) and SMA(50) averages.",
        };
      default:
        return {
          color: "text-muted-foreground bg-muted border-border",
          icon: <Activity size={16} />,
          text: "Neutral / Ranging",
          desc: "Price is consolidation-bound without a strong trend direction.",
        };
    }
  };

  const getEmaConfig = (val: string) => {
    switch (val) {
      case "BULLISH":
        return {
          color: "text-green-500 bg-green-500/5",
          label: "Bullish Alignment",
          desc: "EMA(20) is stacked above SMA(50).",
        };
      case "BEARISH":
        return {
          color: "text-red-500 bg-red-500/5",
          label: "Bearish Alignment",
          desc: "EMA(20) is stacked below SMA(50).",
        };
      default:
        return {
          color: "text-muted-foreground bg-muted/20",
          label: "Flat / Crossing",
          desc: "EMA(20) and SMA(50) are closely intertwined.",
        };
    }
  };

  const trend = getTrendConfig(analytics.trendDirection);
  const ema = getEmaConfig(analytics.emaAlignment);

  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
      <div>
        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block mb-3">
          Trend Intelligence
        </span>
        
        {/* Main Status */}
        <div className="flex items-center gap-2 mb-4">
          <div className={`p-2 rounded-xl border ${trend.color}`}>
            {trend.icon}
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-foreground">{trend.text}</h4>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{trend.desc}</p>
          </div>
        </div>
      </div>

      {/* Sub metrics */}
      <div className="pt-3 border-t border-border/50 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">EMA Alignment</span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${ema.color}`}>
            {ema.label}
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground/80 leading-normal">{ema.desc}</p>
      </div>
    </div>
  );
}
