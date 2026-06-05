"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useMcxStore } from "@/store/useMcxStore";
import { useMcxAuthStore } from "@/store/useMcxAuthStore";
import { 
  Play, 
  Square, 
  Wallet, 
  TrendingUp,
  Activity,
  Zap,
  ShieldCheck,
  Clock,
  Flame,
  Coins,
  Cpu
} from "lucide-react";
import McxPriceChart from "@/components/mcx/McxPriceChart";
import MCXLoader from "@/components/mcx/MCXLoader";
import { motion, AnimatePresence } from "framer-motion";

import { StatCard } from "@/components/shared/StatCard";

interface BotStateItem {
  commodity: string;
  availableBalance: number;
  holdings: number;
  averageBuyPrice: number;
  totalProfit: number;
  totalLoss: number;
  realTotalProfit: number;
  currentStrategy: string;
  marketType: string;
  botMode: string;
  lastAction: string;
  nextAnalysisTime: string | null;
  warningMessage?: string;
}

export default function McxDashboardPage() {
  const { user } = useMcxAuthStore();
  const { 
    selectedCommodity, 
    livePrice, 
    updateLivePrice, 
    priceTrend, 
    botEnabled, 
    setBotEnabled 
  } = useMcxStore();

  const [activeState, setActiveState] = useState<BotStateItem | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loadingChart, setLoadingChart] = useState(true);
  const [loadingBotAction, setLoadingBotAction] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes in seconds

  const [hoverData, setHoverData] = useState<any>(null); // For HUD panel

  const handleCrosshairMove = useCallback((data: any) => {
    setHoverData(data);
  }, []);

  // Reset hover data when commodity changes
  useEffect(() => {
    setHoverData(null);
  }, [selectedCommodity]);

  // Indicator visibilities
  const [showEMA20, setShowEMA20] = useState(true);
  const [showEMA50, setShowEMA50] = useState(true);
  const [showEMA200, setShowEMA200] = useState(false);
  const [showBB, setShowBB] = useState(true);

  // Indian Rupee formatting
  const formatRupee = (value: number) => {
    if (value === undefined || isNaN(value)) return "₹0.00";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(value);
  };

  useEffect(() => {
    let active = true;
    const fetchLivePrice = async () => {
      try {
        const res = await fetch(`/api/mcx/mcx/live-price/${selectedCommodity}`);
        const data = await res.json();
        if (active && data && data.price) {
          updateLivePrice(Number(data.price));
        }
      } catch (err) {
        console.warn("Failed to fetch live price:", err);
      }
    };
    fetchLivePrice();
    const interval = setInterval(fetchLivePrice, 1000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [selectedCommodity, updateLivePrice]);

  useEffect(() => {
    let active = true;
    const fetchChartData = async (showLoading = true) => {
      if (showLoading) setLoadingChart(true);
      try {
        const res = await fetch(`/api/mcx/chart/${selectedCommodity}`);
        const data = await res.json();
        if (active && data && data.success && data.data) {
          setChartData(data.data);
        }
      } catch (err) {
        console.error("Failed to fetch chart data:", err);
      } finally {
        if (active && showLoading) setLoadingChart(false);
      }
    };
    fetchChartData(true);
    const interval = setInterval(() => {
      fetchChartData(false);
    }, 5000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [selectedCommodity]);

  const fetchBotStates = async () => {
    try {
      const res = await fetch("/api/mcx/bot/state");
      const data = await res.json();
      if (data && data.success) {
        setBotEnabled(data.botEnabled);
        const specificState = data.states?.find((s: any) => s.commodity === selectedCommodity);
        if (specificState) {
          setActiveState(specificState);
        }
      }
    } catch (err) {
      console.warn("Failed to fetch bot states:", err);
    }
  };

  useEffect(() => {
    fetchBotStates();
    const interval = setInterval(fetchBotStates, 4000);
    return () => clearInterval(interval);
  }, [selectedCommodity, setBotEnabled]);

  useEffect(() => {
    if (activeState?.nextAnalysisTime) {
      const target = new Date(activeState.nextAnalysisTime).getTime();
      const interval = setInterval(() => {
        const remaining = Math.max(0, Math.floor((target - Date.now()) / 1000));
        setTimeLeft(remaining);
      }, 1000);
      return () => clearInterval(interval);
    } else {
      const interval = setInterval(() => {
        setTimeLeft((prev) => (prev > 0 ? prev - 1 : 300));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [activeState?.nextAnalysisTime]);

  const handleToggleBot = async () => {
    setLoadingBotAction(true);
    const endpoint = botEnabled ? "/api/mcx/bot/disable" : "/api/mcx/bot/enable";
    try {
      const res = await fetch(endpoint, { method: "POST" });
      const data = await res.json();
      if (data && data.success) {
        setBotEnabled(!botEnabled);
        fetchBotStates();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingBotAction(false);
    }
  };

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const availableBalance = activeState?.availableBalance ?? 0;
  const portfolioValue = activeState ? (activeState.availableBalance + activeState.realTotalProfit) : 0;
  const dailyGain = activeState && activeState.availableBalance > 0 ? (activeState.realTotalProfit / activeState.availableBalance) * 100 : 0;

  return (
    <>
      {/* Top Row Cards (Unified with Crypto MarketCards) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Wallet Balance"
          value={formatRupee(availableBalance)}
          subValue="INR Available"
          icon={Wallet}
        />
        <StatCard
          title="Net Asset Value"
          value={formatRupee(portfolioValue)}
          subValue={`${dailyGain >= 0 ? "+" : ""}${dailyGain.toFixed(2)}% Total ROI`}
          icon={TrendingUp}
          trend={dailyGain >= 0 ? "up" : "down"}
        />
        
        {/* Active Asset WebSocket Info */}
        <div className="bg-card border border-primary/30 rounded-xl p-4 flex items-center justify-between col-span-1 lg:col-span-2 shadow-sm hover:shadow-md transition-shadow ring-1 ring-primary/5">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                {selectedCommodity} Realtime
              </span>
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-foreground tracking-tight">
                {formatRupee(livePrice)}
              </span>
            </div>
            <div className="flex gap-4 text-[10px] text-muted-foreground font-medium uppercase tracking-tight">
              <span>Status: <b className="text-foreground font-bold">{botEnabled ? "BOT ACTIVE" : "BOT STOPPED"}</b></span>
              <span>Strategy: <b className="text-foreground font-bold">{activeState?.currentStrategy || "NONE"}</b></span>
              <span>Holding: <b className="text-foreground font-bold">{activeState?.holdings || 0} LOTS</b></span>
            </div>
          </div>
          <div className="p-3 bg-primary/10 rounded-xl border border-primary/20 text-primary shadow-inner hidden sm:block">
            <Activity size={18} />
          </div>
        </div>

        <StatCard
          title="Next Analysis"
          value={formatTime(timeLeft)}
          subValue="5-min interval"
          icon={Clock}
        />
      </div>

      {/* Full Width Chart (Unified with Crypto TradingViewChart) */}
      <div className="w-full">
        <div className="bg-card border border-border rounded-xl p-4 flex flex-col h-auto w-full shadow-sm hover:shadow-md transition-all relative overflow-hidden">
          {/* Background Glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[100px] -z-10 pointer-events-none" />
          
          {/* Header Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 shrink-0 z-10">
            <div className="flex items-center gap-4">
              <div className="flex flex-col">
                <div className="flex items-center gap-3">
                  <h3 className="font-black text-2xl tracking-tighter text-foreground uppercase italic">
                    {selectedCommodity}<span className="text-muted-foreground not-italic font-medium text-lg ml-0.5">/INR</span>
                  </h3>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-secondary border border-border">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      Live
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Clock size={12} /> 15m
                  </span>
                  <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Activity size={12} /> MCX Futures
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Indicator Toggles */}
              <div className="flex items-center bg-secondary p-1 rounded-lg border border-border mr-2 select-none">
                <button
                  onClick={() => setShowEMA20(!showEMA20)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold transition-all border ${showEMA20 ? 'bg-blue-500/10 text-blue-500 border-blue-500/20 shadow-sm' : 'text-muted-foreground border-transparent hover:bg-card-foreground/5'}`}
                >
                  EMA20
                </button>
                <button
                  onClick={() => setShowEMA50(!showEMA50)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold transition-all border ${showEMA50 ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20 shadow-sm' : 'text-muted-foreground border-transparent hover:bg-card-foreground/5'}`}
                >
                  EMA50
                </button>
                <button
                  onClick={() => setShowEMA200(!showEMA200)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold transition-all border ${showEMA200 ? 'bg-purple-500/10 text-purple-500 border-purple-500/20 shadow-sm' : 'text-muted-foreground border-transparent hover:bg-card-foreground/5'}`}
                >
                  EMA200
                </button>
                <button
                  onClick={() => setShowBB(!showBB)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold transition-all border ${showBB ? 'bg-orange-500/10 text-orange-500 border-orange-500/20 shadow-sm' : 'text-muted-foreground border-transparent hover:bg-card-foreground/5'}`}
                >
                  BB
                </button>
              </div>

              <div className="flex bg-secondary p-1 rounded-lg border border-border">
                <button className="text-[10px] font-black px-3 py-1.5 rounded-md transition-all border bg-card text-foreground shadow border border-border">
                  15M
                </button>
              </div>
            </div>
          </div>

          {/* HUD Panel */}
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-4 mb-4 bg-secondary/40 border border-border rounded-xl p-3 backdrop-blur-md z-10 select-none">
            {(() => {
              const currentCandle = hoverData || (chartData.length > 0 ? chartData[chartData.length - 1] : null);
              return [
                { label: "OPEN", val: currentCandle?.open, color: "text-foreground" },
                { label: "HIGH", val: currentCandle?.high, color: "text-emerald-500" },
                { label: "LOW", val: currentCandle?.low, color: "text-rose-500" },
                { label: "CLOSE", val: currentCandle?.close, color: "text-foreground" },
                { label: "VOL", val: currentCandle?.volume, color: "text-muted-foreground" },
                { label: "EMA20", val: currentCandle?.ema20, color: "text-blue-500", show: showEMA20 },
                { label: "EMA50", val: currentCandle?.ema50, color: "text-yellow-500", show: showEMA50 },
                { label: "EMA200", val: currentCandle?.ema200, color: "text-purple-500", show: showEMA200 },
              ].filter(item => item.show !== false).map((item) => (
                <div key={item.label} className="flex flex-col gap-0.5">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter opacity-50">{item.label}</span>
                  <span className={`text-[13px] font-black tabular-nums tracking-tight ${item.color}`}>
                    {item.val ? (typeof item.val === "number" ? item.val.toLocaleString(undefined, { minimumFractionDigits: 2 }) : item.val) : "—"}
                  </span>
                </div>
              ));
            })()}
          </div>

          {/* Main Chart Container */}
          <div className="relative w-full h-[600px] rounded-xl border border-border bg-secondary/15 overflow-hidden">
            {loadingChart ? (
              <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
                <div className="relative">
                  <div className="w-12 h-12 border-2 border-primary/20 rounded-full animate-ping" />
                  <Zap className="absolute inset-0 m-auto text-primary animate-pulse" size={24} />
                </div>
                <span className="text-xs font-bold text-foreground mt-4 uppercase tracking-[0.2em] animate-pulse">Synchronizing Market Data</span>
              </div>
            ) : chartData.length > 0 ? (
              <McxPriceChart 
                key={selectedCommodity}
                data={chartData} 
                showIndicators={{
                  ema20: showEMA20,
                  ema50: showEMA50,
                  ema200: showEMA200,
                  bb: showBB
                }}
                onCrosshairMove={handleCrosshairMove}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                No candle data available for {selectedCommodity}
              </div>
            )}
          </div>
          
          {/* Legend / Footer */}
          <div className="mt-4 flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5"><div className="w-2 h-0.5 bg-blue-500" /> EMA 20</span>
              <span className="flex items-center gap-1.5"><div className="w-2 h-0.5 bg-yellow-500" /> SMA 50</span>
            </div>
            <div>MCX Connectivity: Stable</div>
          </div>
        </div>
      </div>

      {/* Bottom Widgets Grid (Unified with Crypto 2-Column Layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-5">
        {/* Column 1: Bot Operations (matching Crypto's Market Watchlist) */}
        <div className="flex flex-col">
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4 flex flex-col h-full hover:shadow-md transition-all">
            <h3 className="text-sm font-black uppercase tracking-wider text-foreground">
              Bot Engine Operations
            </h3>
            <div className="p-4 bg-muted/20 border border-border rounded-xl flex items-center justify-between mt-auto">
              <div className="flex flex-col leading-none">
                <span className="text-[10px] font-black uppercase text-muted-foreground">
                  Automated Trading
                </span>
                <span className={`text-[11px] font-black uppercase mt-1 ${botEnabled ? "text-green-500" : "text-red-500"}`}>
                  {botEnabled ? "ACTIVE" : "INACTIVE"}
                </span>
              </div>
              <button
                onClick={handleToggleBot}
                disabled={loadingBotAction}
                className={`flex items-center gap-2 px-4 py-2 text-[10px] uppercase font-black tracking-widest rounded-xl transition-all shadow-md active:scale-95 ${
                  botEnabled
                    ? "bg-red-500 text-white shadow-red-500/10 border border-red-600"
                    : "bg-primary text-primary-foreground shadow-primary/20 border border-primary/20 hover:opacity-90"
                }`}
              >
                {loadingBotAction ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : botEnabled ? (
                  <>
                    <Square size={12} fill="white" /> STOP BOT
                  </>
                ) : (
                  <>
                    <Play size={12} fill="white" /> START BOT
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Column 2: Terminal Statistics (matching Crypto's Signal Log) */}
        <div className="flex flex-col">
          <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col p-5 shadow-sm hover:shadow-md transition-all h-full">
            <h3 className="text-sm font-black uppercase tracking-wider text-foreground mb-4">
              Terminal Statistics
            </h3>
            <div className="space-y-3 mt-auto">
              <StatCard
                title="Available Wallet"
                value={activeState ? formatRupee(activeState.availableBalance) : formatRupee(0)}
                icon={Wallet}
              />
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/20 border border-border rounded-xl p-3 flex flex-col">
                  <span className="text-[9px] font-black text-muted-foreground uppercase">Holdings</span>
                  <span className="text-sm font-bold text-foreground">{activeState?.holdings || 0} Lots</span>
                </div>
                <div className="bg-muted/20 border border-border rounded-xl p-3 flex flex-col">
                  <span className="text-[9px] font-black text-muted-foreground uppercase">Avg Entry</span>
                  <span className="text-sm font-bold text-foreground">{activeState ? formatRupee(activeState.averageBuyPrice) : "₹0"}</span>
                </div>
              </div>
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center justify-between shadow-inner mt-2">
                <span className="text-[10px] font-black uppercase text-primary tracking-widest">Realized Profit</span>
                <span className={`font-mono text-base font-black ${
                  (activeState?.realTotalProfit || 0) >= 0 ? "text-green-500" : "text-red-500"
                }`}>
                  {activeState ? formatRupee(activeState.realTotalProfit) : formatRupee(0)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
