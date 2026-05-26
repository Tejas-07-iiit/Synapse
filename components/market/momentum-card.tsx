"use client";

import React from "react";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";
import { MarketAnalytics } from "@/types/market";

interface MomentumCardProps {
  analytics: MarketAnalytics;
}

export default function MomentumCard({ analytics }: MomentumCardProps) {
  const getMomConfig = (val: string) => {
    switch (val) {
      case "STRONG":
        return {
          color: "text-green-500 bg-green-500/10 border-green-500/20",
          icon: <TrendingUp size={16} />,
          text: "Bullish Acceleration",
          desc: "Buying volume is rising. RSI and MACD are pushing upwards.",
        };
      case "WEAK":
        return {
          color: "text-red-500 bg-red-500/10 border-red-500/20",
          icon: <TrendingDown size={16} />,
          text: "Bearish Acceleration",
          desc: "Selling volume is rising. RSI and MACD are falling.",
        };
      default:
        return {
          color: "text-muted-foreground bg-muted border-border",
          icon: <Activity size={16} />,
          text: "Neutral Momentum",
          desc: "Price momentum is flat. No dominant force.",
        };
    }
  };

  const getRsiConfig = (val: string) => {
    switch (val) {
      case "OVERBOUGHT":
        return {
          color: "text-orange-500 bg-orange-500/5",
          label: "Overbought",
          desc: "RSI is >= 70, suggesting exhaustion.",
        };
      case "OVERSOLD":
        return {
          color: "text-purple-500 bg-purple-500/5",
          label: "Oversold",
          desc: "RSI is <= 30, suggesting sellers exhausted.",
        };
      default:
        return {
          color: "text-muted-foreground bg-muted/20",
          label: "Neutral",
          desc: "RSI is inside the normal range.",
        };
    }
  };

  const getMacdConfig = (val: string) => {
    switch (val) {
      case "BULLISH_CROSSOVER":
        return {
          color: "text-green-500 bg-green-500/10",
          label: "Bull Crossover",
        };
      case "BEARISH_CROSSOVER":
        return {
          color: "text-red-500 bg-red-500/10",
          label: "Bear Crossover",
        };
      default:
        return {
          color: "text-muted-foreground bg-muted/30",
          label: "Neutral",
        };
    }
  };

  const mom = getMomConfig(analytics.momentumScore);
  const rsi = getRsiConfig(analytics.rsiStatus);
  const macd = getMacdConfig(analytics.macdStatus);

  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
      <div>
        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block mb-3">
          Momentum Strength
        </span>
        
        {/* Main Status */}
        <div className="flex items-center gap-2 mb-4">
          <div className={`p-2 rounded-xl border ${mom.color}`}>
            {mom.icon}
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-foreground">{mom.text}</h4>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{mom.desc}</p>
          </div>
        </div>
      </div>

      {/* Sub metrics */}
      <div className="pt-3 border-t border-border/50 space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">RSI Condition</span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${rsi.color}`}>
            {rsi.label}
          </span>
        </div>
        
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">MACD Crossover</span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${macd.color}`}>
            {macd.label}
          </span>
        </div>
      </div>
    </div>
  );
}
