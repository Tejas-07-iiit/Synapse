"use client";

import React from "react";
import { Zap, Activity, Sparkles } from "lucide-react";
import { MarketAnalytics } from "@/types/market";

interface VolatilityCardProps {
  analytics: MarketAnalytics;
}

export default function VolatilityCard({ analytics }: VolatilityCardProps) {
  const getVolConfig = (val: string) => {
    switch (val) {
      case "HIGH":
        return {
          color: "text-orange-500 bg-orange-500/10 border-orange-500/20",
          icon: <Zap size={16} />,
          text: "High Volatility",
          desc: "Bollinger Bands are expanding rapidly. Watch for breakouts.",
        };
      case "LOW":
        return {
          color: "text-blue-500 bg-blue-500/10 border-blue-500/20",
          icon: <Activity size={16} />,
          text: "Low Volatility (Squeeze)",
          desc: "Bollinger Bands are compressing, indicating a massive breakout is near.",
        };
      default:
        return {
          color: "text-muted-foreground bg-muted border-border",
          icon: <Sparkles size={16} />,
          text: "Normal Volatility",
          desc: "Price action is trading inside standard historical deviation ranges.",
        };
    }
  };

  const getBbConfig = (val: string) => {
    switch (val) {
      case "ABOVE_UPPER":
        return {
          color: "text-green-500 bg-green-500/5",
          label: "Above Upper Band",
          desc: "Price has exceeded the standard upper band.",
        };
      case "BELOW_LOWER":
        return {
          color: "text-red-500 bg-red-500/5",
          label: "Below Lower Band",
          desc: "Price has broken the standard lower band.",
        };
      default:
        return {
          color: "text-muted-foreground bg-muted/20",
          label: "In Channel",
          desc: "Price is nestled safely between Bollinger Bands.",
        };
    }
  };

  const getVolumeConfig = (val: string) => {
    switch (val) {
      case "HIGH":
        return {
          color: "text-green-500",
          label: "Heavy Volume",
        };
      case "LOW":
        return {
          color: "text-red-500",
          label: "Thin Volume",
        };
      default:
        return {
          color: "text-muted-foreground",
          label: "Average Volume",
        };
    }
  };

  const vol = getVolConfig(analytics.volatilityScore);
  const bb = getBbConfig(analytics.bollingerPosition);
  const volStr = getVolumeConfig(analytics.volumeStrength);

  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
      <div>
        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block mb-3">
          Volatility & Channels
        </span>
        
        {/* Main Status */}
        <div className="flex items-center gap-2 mb-4">
          <div className={`p-2 rounded-xl border ${vol.color}`}>
            {vol.icon}
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-foreground">{vol.text}</h4>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{vol.desc}</p>
          </div>
        </div>
      </div>

      {/* Sub metrics */}
      <div className="pt-3 border-t border-border/50 space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Bollinger Position</span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${bb.color}`}>
            {bb.label}
          </span>
        </div>
        
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Volume Intensity</span>
          <span className={`text-[11px] font-extrabold ${volStr.color}`}>
            {volStr.label}
          </span>
        </div>
      </div>
    </div>
  );
}
