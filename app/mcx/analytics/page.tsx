"use client";

import React, { useState, useEffect } from "react";
import { useMcxStore } from "@/store/useMcxStore";
import { motion } from "framer-motion";
import { 
  Brain, 
  Flame, 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  RefreshCw, 
  Target,
  FileText,
  BarChart3
} from "lucide-react";
import MCXLoader from "@/components/mcx/MCXLoader";

interface MarketConditionData {
  marketCondition: string;
  confidence: number;
  scores: {
    BULLISH: number;
    BEARISH: number;
    SIDEWAYS: number;
    VOLATILE: number;
  };
  strategyUsed: string;
  reasons: string[];
}

export default function McxAnalyticsPage() {
  const { selectedCommodity, livePrice } = useMcxStore();
  const [loading, setLoading] = useState(true);
  const [condition, setCondition] = useState<MarketConditionData | null>(null);
  const [indicators, setIndicators] = useState<any | null>(null);

  // Indian Rupee formatting
  const formatRupee = (value: number) => {
    if (value === undefined || isNaN(value) || value === null) return "₹0.00";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      // Fetch market condition
      const condRes = await fetch(`/api/mcx/mcx/market-condition/${selectedCommodity}`);
      const condData = await condRes.json();
      if (condRes.ok) {
        setCondition(condData);
      }

      // Fetch latest indicator variables
      const indRes = await fetch(`/api/mcx/mcx/indicators/${selectedCommodity}`);
      const indData = await indRes.json();
      if (indRes.ok) {
        setIndicators(indData);
      }
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [selectedCommodity]);

  const conditionColors: Record<string, string> = {
    BULLISH: "text-green-500 bg-green-500/10 border-green-500/20",
    BEARISH: "text-red-500 bg-red-500/10 border-red-500/20",
    SIDEWAYS: "text-blue-500 bg-blue-500/10 border-blue-500/20",
    VOLATILE: "text-primary bg-primary/10 border-primary/20"
  };

  if (loading) {
    return <MCXLoader message={`Analyzing ${selectedCommodity} market indicators...`} />;
  }

  return (
    <div className="space-y-6">
      {/* Page Heading */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight text-foreground">
            {selectedCommodity} AI Analytics
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Realtime artificial intelligence analytics and indicator breakdown.
          </p>
        </div>
        <button
          onClick={fetchAnalytics}
          className="p-2.5 bg-muted/40 hover:bg-muted/80 border border-border rounded-xl transition-all"
        >
          <RefreshCw size={15} className="text-primary" />
        </button>
      </div>

      {/* Main Analysis Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1: Market Status Gauge */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col space-y-4">
          <div className="flex items-center gap-2">
            <Brain className="text-primary h-5 w-5" />
            <h2 className="text-sm font-black uppercase tracking-wider text-foreground">
              Market Sentiment
            </h2>
          </div>

          <div className="flex-1 flex flex-col justify-center items-center py-6">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
              Condition Decided
            </span>
            <span className={`text-2xl font-black uppercase mt-2 px-4 py-2 border rounded-xl tracking-wider ${
              conditionColors[condition?.marketCondition || "SIDEWAYS"]
            }`}>
              {condition?.marketCondition || "SIDEWAYS"}
            </span>

            <div className="w-full mt-6 space-y-1.5">
              <div className="flex justify-between text-xs font-bold text-muted-foreground uppercase">
                <span>Confidence Rating</span>
                <span className="font-mono text-foreground">{condition?.confidence || 0}%</span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden border border-border/50">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${condition?.confidence || 0}%` }}
                  transition={{ duration: 0.8 }}
                  className="h-full bg-gradient-to-r from-primary to-primary/50"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Column 2: Strategy Matcher */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col space-y-4">
          <div className="flex items-center gap-2">
            <Target className="text-primary h-5 w-5" />
            <h2 className="text-sm font-black uppercase tracking-wider text-foreground">
              Recommended Strategy
            </h2>
          </div>

          <div className="flex-1 flex flex-col justify-center py-4 space-y-4">
            <div className="p-4 bg-muted/20 border border-border rounded-xl">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block">
                Active Execution Model
              </span>
              <span className="text-md font-black text-foreground uppercase tracking-wider mt-1 block">
                {condition?.strategyUsed || "Mean Reversion Strategy"}
              </span>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Based on active volume parameters, dynamic ADX trend checking, and exponential moving average crossovers, the artificial intelligence model recommends running a <span className="font-bold text-foreground">{condition?.strategyUsed}</span> for optimal risk-reward ratio.
            </p>
          </div>
        </div>

        {/* Column 3: Sentiment Voting */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col space-y-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="text-primary h-5 w-5" />
            <h2 className="text-sm font-black uppercase tracking-wider text-foreground">
              Indicator Votes
            </h2>
          </div>

          <div className="flex-1 flex flex-col justify-center space-y-3.5">
            {condition?.scores && Object.entries(condition.scores).map(([key, value]) => {
              const total = Object.values(condition.scores).reduce((a, b) => a + b, 0) || 1;
              const pct = ((value / total) * 100).toFixed(0);
              
              return (
                <div key={key} className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-muted-foreground uppercase">
                    <span>{key}</span>
                    <span className="font-mono text-foreground">{value} Votes ({pct}%)</span>
                  </div>
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div 
                      style={{ width: `${pct}%` }} 
                      className={`h-full ${
                        key === "BULLISH" ? "bg-green-500" :
                        key === "BEARISH" ? "bg-red-500" :
                        key === "SIDEWAYS" ? "bg-blue-500" :
                        "bg-primary"
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Dynamic Indicators Breakdown & Reasons */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Card: Market Logic Reasons */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <FileText className="text-primary h-5 w-5" />
            <h2 className="text-sm font-black uppercase tracking-wider text-foreground">
              Structural Analysis
            </h2>
          </div>

          <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-2">
            {condition?.reasons && condition.reasons.length > 0 ? (
              condition.reasons.map((reason, i) => (
                <div 
                  key={i} 
                  className="flex items-start gap-2.5 p-3 bg-muted/20 border border-border/50 rounded-xl text-xs font-semibold text-foreground/80 hover:border-primary/20 transition-colors"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                  <span>{reason}</span>
                </div>
              ))
            ) : (
              <div className="text-xs text-muted-foreground italic">
                Gathering structural points...
              </div>
            )}
          </div>
        </div>

        {/* Right Card: Technical Indicators Values */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Activity className="text-primary h-5 w-5" />
            <h2 className="text-sm font-black uppercase tracking-wider text-foreground">
              Technical Metrics
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-muted/20 border border-border/40 rounded-xl">
              <span className="text-[10px] font-black text-muted-foreground uppercase block">RSI (14)</span>
              <span className="text-sm font-black font-mono mt-1 block">
                {indicators?.rsi !== undefined && indicators?.rsi !== null ? Number(indicators.rsi).toFixed(2) : "N/A"}
              </span>
            </div>

            <div className="p-3 bg-muted/20 border border-border/40 rounded-xl">
              <span className="text-[10px] font-black text-muted-foreground uppercase block">ADX Trend Strength</span>
              <span className="text-sm font-black font-mono mt-1 block">
                {indicators?.adx !== undefined && indicators?.adx !== null ? Number(indicators.adx).toFixed(2) : "N/A"}
              </span>
            </div>

            <div className="p-3 bg-muted/20 border border-border/40 rounded-xl">
              <span className="text-[10px] font-black text-muted-foreground uppercase block">ATR volatility</span>
              <span className="text-sm font-black font-mono mt-1 block">
                {indicators?.atr !== undefined && indicators?.atr !== null ? formatRupee(indicators.atr) : "N/A"}
              </span>
            </div>

            <div className="p-3 bg-muted/20 border border-border/40 rounded-xl">
              <span className="text-[10px] font-black text-muted-foreground uppercase block">EMA Crossovers</span>
              <span className="text-xs font-black font-mono mt-1 block text-primary">
                EMA20: {indicators?.ema20 ? indicators.ema20.toFixed(2) : "N/A"} / EMA50: {indicators?.ema50 ? indicators.ema50.toFixed(2) : "N/A"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
