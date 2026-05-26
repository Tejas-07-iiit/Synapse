"use client";

import React from "react";
import { Compass, HelpCircle, Shuffle, ShieldAlert, ArrowRightCircle } from "lucide-react";
import { MarketAnalytics } from "@/types/market";

interface RegimeCardProps {
  analytics: MarketAnalytics;
}

export default function RegimeCard({ analytics }: RegimeCardProps) {
  const getRegimeConfig = (val: string) => {
    switch (val) {
      case "BULLISH":
        return {
          color: "text-green-500 bg-green-500/10 border-green-500/20",
          icon: <ArrowRightCircle className="rotate-[-45deg]" size={16} />,
          text: "BULLISH REGIME",
          desc: "Constructive uptrend. Buy and hold strategies perform best in this regime.",
        };
      case "BEARISH":
        return {
          color: "text-red-500 bg-red-500/10 border-red-500/20",
          icon: <ArrowRightCircle className="rotate-[45deg]" size={16} />,
          text: "BEARISH REGIME",
          desc: "Persistent markdown. Short positions or cash preservation are favored.",
        };
      case "ACCUMULATION":
        return {
          color: "text-purple-500 bg-purple-500/10 border-purple-500/20",
          icon: <Compass size={16} />,
          text: "ACCUMULATION REGIME",
          desc: "Smart money buying. Prices range tightly, but demand builds under the surface.",
        };
      case "DISTRIBUTION":
        return {
          color: "text-orange-500 bg-orange-500/10 border-orange-500/20",
          icon: <Compass size={16} />,
          text: "DISTRIBUTION REGIME",
          desc: "Insiders selling. Range-bound top with selling pressure expanding on rallies.",
        };
      case "VOLATILE":
        return {
          color: "text-yellow-500 bg-yellow-500/10 border-yellow-500/20",
          icon: <ShieldAlert size={16} />,
          text: "HIGH VOLATILITY REGIME",
          desc: "Erratic swings. Extreme risk; breakout and swing trading are highly active.",
        };
      default: // SIDEWAYS
        return {
          color: "text-blue-500 bg-blue-500/10 border-blue-500/20",
          icon: <Shuffle size={16} />,
          text: "SIDEWAYS REGIME",
          desc: "Mean-reverting environment. Range trading and grid strategies work best.",
        };
    }
  };

  const reg = getRegimeConfig(analytics.marketRegime);

  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
      <div>
        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block mb-3">
          Market Regime Classifier
        </span>
        
        {/* Main Status */}
        <div className="flex items-center gap-2 mb-4">
          <div className={`p-2 rounded-xl border ${reg.color}`}>
            {reg.icon}
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-foreground">{reg.text}</h4>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{reg.desc}</p>
          </div>
        </div>
      </div>

      {/* Sub Info */}
      <div className="pt-3 border-t border-border/50">
        <p className="text-[10px] text-muted-foreground/60 leading-normal flex items-start gap-1">
          <HelpCircle size={10} className="shrink-0 mt-0.5" />
          <span>Regimes use MACD slopes, volume weights and RSI thresholds to classify current market dynamics.</span>
        </p>
      </div>
    </div>
  );
}
