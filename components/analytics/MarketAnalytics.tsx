"use client";

import React from "react";
import { useMarketStore } from "@/store/market/useMarketStore";
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Zap, 
  BarChart3, 
  Shuffle, 
  AlertTriangle,
  Info
} from "lucide-react";

export default function MarketAnalytics() {
  const analytics = useMarketStore((state) => state.analytics);
  const loading = useMarketStore((state) => state.loading);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 animate-pulse">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4 h-24 flex flex-col justify-between">
            <div className="h-3 bg-muted rounded w-3/4"></div>
            <div className="h-6 bg-muted rounded w-1/2 mt-2"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 text-center text-muted-foreground text-sm">
        No market analytics computed yet. Connect streams to begin calculations.
      </div>
    );
  }

  // Helper to format values and classes
  const getTrendStyle = (trend: string) => {
    switch (trend) {
      case "BULLISH":
        return {
          bg: "bg-green-500/10 border-green-500/20",
          text: "text-green-500",
          icon: <TrendingUp className="text-green-500" size={16} />,
          label: "Bullish"
        };
      case "BEARISH":
        return {
          bg: "bg-red-500/10 border-red-500/20",
          text: "text-red-500",
          icon: <TrendingDown className="text-red-500" size={16} />,
          label: "Bearish"
        };
      default:
        return {
          bg: "bg-muted/30 border-border",
          text: "text-muted-foreground",
          icon: <Activity className="text-muted-foreground" size={16} />,
          label: "Neutral"
        };
    }
  };

  const getRsiStyle = (rsi: string) => {
    switch (rsi) {
      case "OVERBOUGHT":
        return {
          bg: "bg-red-500/10 border-red-500/20",
          text: "text-red-500",
          icon: <AlertTriangle className="text-red-500" size={16} />,
          label: "Overbought"
        };
      case "OVERSOLD":
        return {
          bg: "bg-green-500/10 border-green-500/20",
          text: "text-green-500",
          icon: <AlertTriangle className="text-green-500" size={16} />,
          label: "Oversold"
        };
      default:
        return {
          bg: "bg-muted/30 border-border",
          text: "text-muted-foreground",
          icon: <Info className="text-muted-foreground" size={16} />,
          label: "Neutral"
        };
    }
  };

  const getVolatilityStyle = (vol: string) => {
    switch (vol) {
      case "HIGH":
        return {
          bg: "bg-orange-500/10 border-orange-500/20",
          text: "text-orange-500",
          icon: <Zap className="text-orange-500" size={16} />,
          label: "High"
        };
      case "LOW":
        return {
          bg: "bg-blue-500/10 border-blue-500/20",
          text: "text-blue-500",
          icon: <Zap className="text-blue-500" size={16} />,
          label: "Low (Squeeze)"
        };
      default:
        return {
          bg: "bg-muted/30 border-border",
          text: "text-muted-foreground",
          icon: <Zap className="text-muted-foreground" size={16} />,
          label: "Normal"
        };
    }
  };

  const getMomentumStyle = (mom: string) => {
    switch (mom) {
      case "STRONG":
        return {
          bg: "bg-green-500/10 border-green-500/20",
          text: "text-green-500",
          icon: <TrendingUp className="text-green-500" size={16} />,
          label: "Strong Bullish"
        };
      case "WEAK":
        return {
          bg: "bg-red-500/10 border-red-500/20",
          text: "text-red-500",
          icon: <TrendingDown className="text-red-500" size={16} />,
          label: "Weak Bearish"
        };
      default:
        return {
          bg: "bg-muted/30 border-border",
          text: "text-muted-foreground",
          icon: <Activity className="text-muted-foreground" size={16} />,
          label: "Neutral"
        };
    }
  };

  const getVolumeStyle = (vol: string) => {
    switch (vol) {
      case "HIGH":
        return {
          bg: "bg-green-500/10 border-green-500/20",
          text: "text-green-500",
          icon: <BarChart3 className="text-green-500" size={16} />,
          label: "High Volume"
        };
      case "LOW":
        return {
          bg: "bg-red-500/10 border-red-500/20",
          text: "text-red-500",
          icon: <BarChart3 className="text-red-500" size={16} />,
          label: "Low Volume"
        };
      default:
        return {
          bg: "bg-muted/30 border-border",
          text: "text-muted-foreground",
          icon: <BarChart3 className="text-muted-foreground" size={16} />,
          label: "Average Volume"
        };
    }
  };

  const getRegimeStyle = (regime: string) => {
    switch (regime) {
      case "TRENDING":
        return {
          bg: "bg-purple-500/10 border-purple-500/20",
          text: "text-purple-500",
          icon: <Shuffle className="text-purple-500" size={16} />,
          label: "Trending"
        };
      default:
        return {
          bg: "bg-amber-500/10 border-amber-500/20",
          text: "text-amber-500",
          icon: <Shuffle className="text-amber-500" size={16} />,
          label: "Ranging"
        };
    }
  };

  const trend = getTrendStyle(analytics.trendDirection);
  const rsi = getRsiStyle(analytics.rsiStatus);
  const vol = getVolatilityStyle(analytics.volatilityScore);
  const mom = getMomentumStyle(analytics.momentumScore);
  const volStr = getVolumeStyle(analytics.volumeStrength);
  const regime = getRegimeStyle(analytics.marketRegime);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {/* Trend Card */}
      <div className="bg-card border border-border rounded-xl p-4 flex flex-col justify-between hover:shadow-md transition-all">
        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">
          Trend Direction
        </span>
        <div className="flex items-center gap-2 mt-2">
          <div className={`p-1.5 rounded-lg border ${trend.bg}`}>
            {trend.icon}
          </div>
          <span className={`text-sm font-extrabold ${trend.text}`}>{trend.label}</span>
        </div>
      </div>

      {/* RSI Card */}
      <div className="bg-card border border-border rounded-xl p-4 flex flex-col justify-between hover:shadow-md transition-all">
        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">
          RSI Status
        </span>
        <div className="flex items-center gap-2 mt-2">
          <div className={`p-1.5 rounded-lg border ${rsi.bg}`}>
            {rsi.icon}
          </div>
          <span className={`text-sm font-extrabold ${rsi.text}`}>{rsi.label}</span>
        </div>
      </div>

      {/* Volatility Card */}
      <div className="bg-card border border-border rounded-xl p-4 flex flex-col justify-between hover:shadow-md transition-all">
        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">
          Volatility Score
        </span>
        <div className="flex items-center gap-2 mt-2">
          <div className={`p-1.5 rounded-lg border ${vol.bg}`}>
            {vol.icon}
          </div>
          <span className={`text-sm font-extrabold ${vol.text}`}>{vol.label}</span>
        </div>
      </div>

      {/* Momentum Card */}
      <div className="bg-card border border-border rounded-xl p-4 flex flex-col justify-between hover:shadow-md transition-all">
        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">
          Momentum Score
        </span>
        <div className="flex items-center gap-2 mt-2">
          <div className={`p-1.5 rounded-lg border ${mom.bg}`}>
            {mom.icon}
          </div>
          <span className={`text-sm font-extrabold ${mom.text}`}>{mom.label}</span>
        </div>
      </div>

      {/* Volume Card */}
      <div className="bg-card border border-border rounded-xl p-4 flex flex-col justify-between hover:shadow-md transition-all">
        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">
          Volume Strength
        </span>
        <div className="flex items-center gap-2 mt-2">
          <div className={`p-1.5 rounded-lg border ${volStr.bg}`}>
            {volStr.icon}
          </div>
          <span className={`text-sm font-extrabold ${volStr.text}`}>{volStr.label}</span>
        </div>
      </div>

      {/* Regime Card */}
      <div className="bg-card border border-border rounded-xl p-4 flex flex-col justify-between hover:shadow-md transition-all">
        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">
          Market Regime
        </span>
        <div className="flex items-center gap-2 mt-2">
          <div className={`p-1.5 rounded-lg border ${regime.bg}`}>
            {regime.icon}
          </div>
          <span className={`text-sm font-extrabold ${regime.text}`}>{regime.label}</span>
        </div>
      </div>
    </div>
  );
}
