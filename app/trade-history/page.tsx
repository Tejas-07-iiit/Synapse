"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { useMarketStore } from "@/src/stores/marketStore";
import Sidebar from "@/components/sidebar/Sidebar";
import Navbar from "@/components/navbar/Navbar";
import { 
  Search, 
  Info, 
  DollarSign, 
  Percent, 
  Activity, 
  Award, 
  AlertCircle, 
  X, 
  Clock,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";

interface DbPosition {
  id: string;
  userId: string;
  symbol: string;
  direction: string;
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  stopLoss: number | null;
  takeProfit: number | null;
  leverage: number;
  pnl: number;
  status: string;
  openedAt: string;
  closedAt: string | null;
  strategyId?: string | null;
  strategyName?: string | null;
  entryReason?: string | null;
  confidenceAtEntry?: number | null;
}

interface DbTrade {
  id: string;
  userId: string;
  symbol: string;
  strategyName: string;
  direction: string;
  entryPrice: number;
  exitPrice: number;
  currentPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  quantity: number;
  leverage: number;
  pnl: number;
  roi: number;
  confidence: number;
  status: string;
  openedAt: string;
  closedAt: string;
  executionType: string;
  strategyId?: string | null;
  strategyCategory?: string | null;
  entryReason?: string | null;
  exitReason?: string | null;
  confidenceAtEntry?: number | null;
  marketRegime?: string | null;
  indicatorSnapshot?: any | null;
}

interface UnifiedTrade {
  id: string;
  symbol: string;
  strategyId?: string | null;
  strategyName: string;
  strategyCategory?: string | null;
  direction: "LONG" | "SHORT";
  entryPrice: number;
  exitPrice?: number;
  currentPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
  leverage: number;
  quantity: number;
  pnl: number;
  roi: number;
  confidence: number;
  status: "OPEN" | "CLOSED" | "STOPPED" | "TP HIT";
  openedAt: Date;
  closedAt: Date | null;
  entryReason?: string | null;
  exitReason?: string | null;
  confidenceAtEntry?: number | null;
  marketRegime?: string | null;
  indicatorSnapshot?: any | null;
}

export default function TradeHistoryPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuthStore();
  const tickerData = useMarketStore((state) => state.tickerData);

  // States
  const [activePositions, setActivePositions] = useState<DbPosition[]>([]);
  const [closedTrades, setClosedTrades] = useState<DbTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTrade, setSelectedTrade] = useState<UnifiedTrade | null>(null);

  // Filters state
  const [selectedSymbolFilter, setSelectedSymbolFilter] = useState("ALL");
  const [selectedStrategyFilter, setSelectedStrategyFilter] = useState("ALL");
  const [selectedDirectionFilter, setSelectedDirectionFilter] = useState("ALL");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, authLoading, router]);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const [posRes, tradeRes] = await Promise.all([
        fetch(`/api/positions?userId=${user.id}&type=active`),
        fetch(`/api/positions?userId=${user.id}&type=closed`),
      ]);

      const posData = await posRes.json();
      const tradeData = await tradeRes.json();

      if (posData.success) {
        setActivePositions(posData.positions || []);
      }
      if (tradeData.success) {
        setClosedTrades(tradeData.trades || []);
      }
      setError(null);
    } catch (err) {
      console.error("[TradeHistory] Error fetching data:", err);
      setError("Failed to fetch trade records. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      fetchData();
    }
  }, [user?.id, fetchData]);

  const unifiedTrades = useMemo(() => {
    const list: UnifiedTrade[] = [];

    // Map active positions
    activePositions.forEach((pos) => {
      // Calculate dynamic real-time current price, PNL, and ROI
      const livePrice = tickerData[pos.symbol]?.price || pos.currentPrice || pos.entryPrice;
      const leverage = pos.leverage || 1;
      const isLong = pos.direction === "LONG";
      
      const currentPrice = livePrice;
      const entryVal = pos.entryPrice * pos.quantity;
      const currentVal = currentPrice * pos.quantity;
      
      const pnl = isLong 
        ? (currentVal - entryVal) * leverage
        : (entryVal - currentVal) * leverage;
        
      const roi = isLong
        ? ((currentPrice - pos.entryPrice) / pos.entryPrice) * 100 * leverage
        : ((pos.entryPrice - currentPrice) / pos.entryPrice) * 100 * leverage;

      list.push({
        id: pos.id,
        symbol: pos.symbol,
        strategyId: pos.strategyId || null,
        strategyName: pos.strategyName || "Central Engine",
        strategyCategory: (pos as any).strategyCategory || null,
        direction: pos.direction as "LONG" | "SHORT",
        entryPrice: pos.entryPrice,
        currentPrice,
        stopLoss: pos.stopLoss,
        takeProfit: pos.takeProfit,
        leverage,
        quantity: pos.quantity,
        pnl,
        roi,
        confidence: pos.confidenceAtEntry !== null && pos.confidenceAtEntry !== undefined ? pos.confidenceAtEntry * 100 : 80,
        status: "OPEN",
        openedAt: new Date(pos.openedAt),
        closedAt: null,
        entryReason: pos.entryReason || "Central Engine Signal",
        exitReason: undefined,
        confidenceAtEntry: pos.confidenceAtEntry || null,
        marketRegime: (pos as any).marketRegime || null,
        indicatorSnapshot: (pos as any).indicatorSnapshot || null,
      });
    });

    // Map closed trades
    closedTrades.forEach((tr) => {
      list.push({
        id: tr.id,
        symbol: tr.symbol,
        strategyId: tr.strategyId || null,
        strategyName: tr.strategyName || "Central Engine",
        strategyCategory: tr.strategyCategory || null,
        direction: tr.direction as "LONG" | "SHORT",
        entryPrice: tr.entryPrice,
        exitPrice: tr.exitPrice,
        currentPrice: tr.exitPrice,
        stopLoss: tr.stopLoss,
        takeProfit: tr.takeProfit,
        leverage: tr.leverage || 1,
        quantity: tr.quantity || 0,
        pnl: tr.pnl,
        roi: tr.roi,
        confidence: tr.confidenceAtEntry !== null && tr.confidenceAtEntry !== undefined ? tr.confidenceAtEntry * 100 : (tr.confidence ? tr.confidence * 100 : 80),
        status: tr.status as "OPEN" | "CLOSED" | "STOPPED" | "TP HIT",
        openedAt: new Date(tr.openedAt),
        closedAt: new Date(tr.closedAt),
        entryReason: tr.entryReason || "Central Engine Signal",
        exitReason: tr.exitReason || "Closed at exit price.",
        confidenceAtEntry: tr.confidenceAtEntry || null,
        marketRegime: tr.marketRegime || null,
        indicatorSnapshot: tr.indicatorSnapshot || null,
      });
    });

    // Sort by openedAt desc
    return list.sort((a, b) => b.openedAt.getTime() - a.openedAt.getTime());
  }, [activePositions, closedTrades, tickerData]);

  // Derived Statistics
  const stats = useMemo(() => {
    const closed = unifiedTrades.filter(t => t.status !== "OPEN");
    const total = closed.length;
    const wins = closed.filter(t => t.pnl > 0).length;
    const losses = closed.filter(t => t.pnl <= 0).length;
    const winRate = total > 0 ? (wins / total) * 100 : 0;
    const lossRate = total > 0 ? (losses / total) * 100 : 0;
    
    const totalPnl = unifiedTrades.reduce((sum, t) => sum + t.pnl, 0);
    const avgRoi = total > 0 ? closed.reduce((sum, t) => sum + t.roi, 0) / total : 0;

    let bestTrade = closed.length > 0 ? closed[0] : null;
    let worstTrade = closed.length > 0 ? closed[0] : null;

    closed.forEach((t) => {
      if (bestTrade && t.pnl > bestTrade.pnl) bestTrade = t;
      if (worstTrade && t.pnl < worstTrade.pnl) worstTrade = t;
    });

    return {
      totalTrades: unifiedTrades.length,
      closedTradesCount: total,
      activeTradesCount: unifiedTrades.filter(t => t.status === "OPEN").length,
      winRate,
      lossRate,
      totalPnl,
      avgRoi,
      bestTrade,
      worstTrade
    };
  }, [unifiedTrades]);

  // Unique Strategies and Coins for Filter Lists
  const filterOptions = useMemo(() => {
    const coins = Array.from(new Set(unifiedTrades.map((t) => t.symbol)));
    const strategies = Array.from(new Set(unifiedTrades.map((t) => t.strategyName)));
    return { coins, strategies };
  }, [unifiedTrades]);

  // Filtered list
  const filteredTrades = useMemo(() => {
    return unifiedTrades.filter((trade) => {
      const coinMatch = selectedSymbolFilter === "ALL" || trade.symbol === selectedSymbolFilter;
      const strategyMatch = selectedStrategyFilter === "ALL" || trade.strategyName === selectedStrategyFilter;
      const directionMatch = selectedDirectionFilter === "ALL" || trade.direction === selectedDirectionFilter;
      
      let statusMatch = true;
      if (selectedStatusFilter !== "ALL") {
        statusMatch = trade.status === selectedStatusFilter;
      }

      const searchMatch = 
        searchQuery === "" ||
        trade.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        trade.strategyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        trade.id.toLowerCase().includes(searchQuery.toLowerCase());

      return coinMatch && strategyMatch && directionMatch && statusMatch && searchMatch;
    });
  }, [unifiedTrades, selectedSymbolFilter, selectedStrategyFilter, selectedDirectionFilter, selectedStatusFilter, searchQuery]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground font-semibold">Loading authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-background text-foreground overflow-hidden font-sans transition-colors duration-300">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Panel Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-background/95">
        {/* Top Navbar */}
        <Navbar />

        {/* Trade History Workspace Body */}
        <main className="flex-1 px-8 py-6 pb-16 space-y-6 min-h-0">
          
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-4">
            <div>
              <h1 className="text-xl font-black tracking-tight text-foreground uppercase flex items-center gap-2">
                <Clock className="text-primary animate-pulse" size={22} />
                Trade Audit & History
              </h1>
              <p className="text-xs text-muted-foreground">
                Institutional-grade record auditing for all active and completed trades.
              </p>
            </div>
            
            <button 
              onClick={fetchData} 
              className="px-4 py-2 bg-secondary/80 hover:bg-secondary text-foreground text-xs font-black uppercase tracking-wider rounded-xl border border-border transition duration-200"
            >
              Refresh Records
            </button>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-xl p-4 flex items-center gap-3">
              <AlertCircle size={20} />
              <p className="text-xs font-semibold">{error}</p>
            </div>
          )}

          {/* Section 1: Trade Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Card 1: Total Trades & Active */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">Volume Metrics</span>
                <Activity size={18} className="text-primary" />
              </div>
              <div className="flex justify-between items-baseline">
                <div>
                  <span className="text-2xl font-black">{stats.totalTrades}</span>
                  <span className="text-xs text-muted-foreground ml-1">Total</span>
                </div>
                <div className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-black uppercase">
                  {stats.activeTradesCount} Active
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">
                All execution channels aggregated.
              </p>
            </div>

            {/* Card 2: Performance Rates */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">Win / Loss Ratio</span>
                <Award size={18} className="text-amber-500" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-xl font-black text-emerald-500">{stats.winRate.toFixed(1)}%</span>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Win Rate</p>
                </div>
                <div>
                  <span className="text-xl font-black text-destructive">{stats.lossRate.toFixed(1)}%</span>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Loss Rate</p>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Based on {stats.closedTradesCount} completed executions.
              </p>
            </div>

            {/* Card 3: Aggregate Profit & Loss */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">Net Profitability</span>
                <DollarSign size={18} className={stats.totalPnl >= 0 ? "text-emerald-500" : "text-destructive"} />
              </div>
              <div>
                <span className={`text-2xl font-black ${stats.totalPnl >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                  {stats.totalPnl >= 0 ? "+" : ""}${stats.totalPnl.toFixed(2)}
                </span>
                <span className="text-[10px] text-muted-foreground ml-1.5 font-bold uppercase block">
                  Avg ROI: {stats.avgRoi.toFixed(2)}%
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Includes floating positions evaluation.
              </p>
            </div>

            {/* Card 4: Best & Worst Trades */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">Extreme Outliers</span>
                <Percent size={18} className="text-purple-500" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-sm font-black text-emerald-500">
                    {stats.bestTrade ? `+$${stats.bestTrade.pnl.toFixed(1)}` : "--"}
                  </span>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Best ({stats.bestTrade?.symbol || "-"})</p>
                </div>
                <div>
                  <span className="text-sm font-black text-destructive">
                    {stats.worstTrade ? `-$${Math.abs(stats.worstTrade.pnl).toFixed(1)}` : "--"}
                  </span>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Worst ({stats.worstTrade?.symbol || "-"})</p>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Closed trade statistics only.
              </p>
            </div>

          </div>

          {/* Section 3: Filters Control Panel */}
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col lg:flex-row gap-4 items-center justify-between">
            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              
              {/* Search Query Input */}
              <div className="relative flex-1 sm:flex-initial min-w-[200px]">
                <Search className="absolute left-3 top-2.5 text-muted-foreground" size={14} />
                <input
                  type="text"
                  placeholder="Search symbol or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-secondary/40 border border-border text-xs rounded-xl focus:outline-none focus:border-primary text-foreground"
                />
              </div>

              {/* Coin Symbol Filter */}
              <div className="flex items-center gap-1.5 bg-secondary/40 border border-border px-2.5 py-1.5 rounded-xl text-xs">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Asset:</span>
                <select
                  value={selectedSymbolFilter}
                  onChange={(e) => setSelectedSymbolFilter(e.target.value)}
                  className="bg-transparent text-foreground border-none font-bold uppercase focus:outline-none cursor-pointer"
                >
                  <option value="ALL">ALL</option>
                  {filterOptions.coins.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Strategy Filter */}
              <div className="flex items-center gap-1.5 bg-secondary/40 border border-border px-2.5 py-1.5 rounded-xl text-xs">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Strategy:</span>
                <select
                  value={selectedStrategyFilter}
                  onChange={(e) => setSelectedStrategyFilter(e.target.value)}
                  className="bg-transparent text-foreground border-none font-bold focus:outline-none cursor-pointer"
                >
                  <option value="ALL">ALL</option>
                  {filterOptions.strategies.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Direction Filter */}
              <div className="flex items-center gap-1.5 bg-secondary/40 border border-border px-2.5 py-1.5 rounded-xl text-xs">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Side:</span>
                <select
                  value={selectedDirectionFilter}
                  onChange={(e) => setSelectedDirectionFilter(e.target.value)}
                  className="bg-transparent text-foreground border-none font-bold focus:outline-none cursor-pointer"
                >
                  <option value="ALL">ALL</option>
                  <option value="LONG">LONG</option>
                  <option value="SHORT">SHORT</option>
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5 bg-secondary/40 border border-border px-2.5 py-1.5 rounded-xl text-xs">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Status:</span>
                <select
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value)}
                  className="bg-transparent text-foreground border-none font-bold focus:outline-none cursor-pointer"
                >
                  <option value="ALL">ALL</option>
                  <option value="OPEN">OPEN</option>
                  <option value="CLOSED">CLOSED</option>
                  <option value="STOPPED">STOPPED</option>
                  <option value="TP HIT">TP HIT</option>
                </select>
              </div>

            </div>
            
            <div className="text-[10px] font-black uppercase text-muted-foreground self-end lg:self-auto">
              Showing {filteredTrades.length} of {unifiedTrades.length} Records
            </div>
          </div>

          {/* Section 2: Main Trade Table */}
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/80 bg-secondary/20 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                    <th className="px-5 py-4">Asset / Side</th>
                    <th className="px-5 py-4">Strategy</th>
                    <th className="px-5 py-4 text-right">Entry Price</th>
                    <th className="px-5 py-4 text-right">Exit / Current</th>
                    <th className="px-5 py-4 text-right">Stop Loss</th>
                    <th className="px-5 py-4 text-right">Take Profit</th>
                    <th className="px-5 py-4 text-right">PnL (ROI)</th>
                    <th className="px-5 py-4 text-center">Status</th>
                    <th className="px-5 py-4 text-right">Execution Date</th>
                    <th className="px-5 py-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 text-xs">
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="px-5 py-12 text-center text-muted-foreground font-semibold">
                        <Activity className="animate-spin text-primary mx-auto mb-2" size={24} />
                        Querying trade audit log...
                      </td>
                    </tr>
                  ) : filteredTrades.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-5 py-12 text-center text-muted-foreground">
                        No trade records found matching selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredTrades.map((trade) => {
                      const isProfit = trade.pnl >= 0;

                      return (
                        <tr 
                          key={trade.id} 
                          className="hover:bg-secondary/20 transition-colors group border-b border-border/40"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold tracking-tight text-foreground">{trade.symbol}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase border ${
                                trade.direction === "LONG" 
                                  ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
                                  : "bg-destructive/10 text-destructive border-destructive/20"
                              }`}>
                                {trade.direction}
                              </span>
                              {trade.leverage > 1 && (
                                <span className="text-[9px] font-bold bg-secondary border border-border px-1.5 py-0.5 rounded text-muted-foreground">
                                  {trade.leverage}x
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase border ${
                              trade.strategyName.includes("Lorentzian")
                                ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                                : trade.strategyName.includes("Bollinger") || trade.strategyName.includes("Donchian")
                                ? "bg-pink-500/10 text-pink-500 border-pink-500/20"
                                : trade.strategyName.includes("Grid") || trade.strategyName.includes("Sweep") || trade.strategyName.includes("SR Sweep")
                                ? "bg-purple-500/10 text-purple-500 border-purple-500/20"
                                : trade.strategyName.includes("Momentum")
                                ? "bg-indigo-500/10 text-indigo-500 border-indigo-500/20"
                                : trade.strategyName.includes("Mean Reversion")
                                ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                : trade.strategyName.includes("Defensive")
                                ? "bg-cyan-500/10 text-cyan-500 border-cyan-500/20"
                                : trade.strategyName.includes("Rally Base Drop")
                                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                : trade.strategyName.includes("Reversal") || trade.strategyName.includes("Reversion") || trade.strategyName.includes("Dow Factor")
                                ? "bg-orange-500/10 text-orange-500 border-orange-500/20"
                                : "bg-secondary text-muted-foreground border-border"
                            }`}>
                              {trade.strategyName}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right font-semibold">
                            ${trade.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                          </td>
                          <td className="px-5 py-4 text-right font-semibold text-foreground">
                            ${trade.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                          </td>
                          <td className="px-5 py-4 text-right text-muted-foreground font-medium">
                            {trade.stopLoss ? `$${trade.stopLoss.toLocaleString()}` : "--"}
                          </td>
                          <td className="px-5 py-4 text-right text-muted-foreground font-medium">
                            {trade.takeProfit ? `$${trade.takeProfit.toLocaleString()}` : "--"}
                          </td>
                          <td className={`px-5 py-4 text-right font-extrabold`}>
                            <div className={`flex flex-col items-end ${isProfit ? "text-emerald-500" : "text-destructive"}`}>
                              <span className="flex items-center gap-0.5">
                                {isProfit ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                                {isProfit ? "+" : ""}${trade.pnl.toFixed(2)}
                              </span>
                              <span className="text-[10px] font-bold">
                                {isProfit ? "+" : ""}{trade.roi.toFixed(2)}%
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase border ${
                              trade.status === "OPEN" 
                                ? "bg-primary/10 text-primary border-primary/20 animate-pulse"
                                : trade.status === "TP HIT"
                                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                : trade.status === "STOPPED"
                                ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                : "bg-secondary text-muted-foreground border-border"
                            }`}>
                              {trade.status}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right text-muted-foreground font-medium whitespace-nowrap">
                            {trade.openedAt.toLocaleDateString()} {trade.openedAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-5 py-4 text-center">
                            <button
                              onClick={() => setSelectedTrade(trade)}
                              className="p-1 hover:bg-secondary rounded-lg text-muted-foreground hover:text-primary transition-all cursor-pointer"
                              title="Audit Trade Details"
                            >
                              <Info size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </main>
      </div>

      {/* Section 4: Trade Audit Details Modal (Redesigned as TRADE EXECUTION REPORT) */}
      {selectedTrade && (() => {
        const indicatorsObj = selectedTrade.indicatorSnapshot;
        
        const formatDuration = (openedAt: Date, closedAt: Date | null) => {
          if (!closedAt) return "Ongoing";
          const diffMs = closedAt.getTime() - openedAt.getTime();
          const diffMins = Math.floor(diffMs / 60000);
          if (diffMins < 60) return `${diffMins}m`;
          const diffHours = Math.floor(diffMins / 60);
          const mins = diffMins % 60;
          if (diffHours < 24) return `${diffHours}h ${mins}m`;
          const diffDays = Math.floor(diffHours / 24);
          const hours = diffHours % 24;
          return `${diffDays}d ${hours}h`;
        };

        const calculateRMultiple = (t: UnifiedTrade) => {
          if (!t.stopLoss || t.entryPrice === t.stopLoss) return "N/A";
          const exit = t.exitPrice || t.currentPrice;
          if (t.direction === "LONG") {
            const risk = t.entryPrice - t.stopLoss;
            if (risk <= 0) return "N/A";
            const reward = exit - t.entryPrice;
            return (reward / risk).toFixed(2) + " R";
          } else {
            const risk = t.stopLoss - t.entryPrice;
            if (risk <= 0) return "N/A";
            const reward = t.entryPrice - exit;
            return (reward / risk).toFixed(2) + " R";
          }
        };

        const renderIndicatorSnapshot = (indicators: any) => {
          if (!indicators) return <p className="text-muted-foreground italic text-xs">No snapshot available</p>;
          
          let parsed = indicators;
          if (typeof indicators === "string") {
            try {
              parsed = JSON.parse(indicators);
            } catch (e) {
              return <p className="text-muted-foreground italic text-xs">Failed to parse indicators snapshot</p>;
            }
          }
          
          const keys = Object.keys(parsed);
          if (keys.length === 0) return <p className="text-muted-foreground italic text-xs">No indicators recorded</p>;

          return (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] font-mono">
              {keys.map((k) => {
                const val = parsed[k];
                if (val === undefined || val === null) return null;
                let displayVal = "";
                if (typeof val === "number") {
                  displayVal = val.toLocaleString(undefined, { maximumFractionDigits: 4 });
                } else if (Array.isArray(val)) {
                  displayVal = val.length > 0 && typeof val[val.length - 1] === "number"
                    ? val[val.length - 1].toLocaleString(undefined, { maximumFractionDigits: 4 })
                    : String(val[val.length - 1]);
                } else {
                  displayVal = String(val);
                }
                return (
                  <div key={k} className="bg-secondary/30 border border-border/55 px-2 py-1 rounded flex justify-between">
                    <span className="text-muted-foreground uppercase">{k}:</span>
                    <span className="font-extrabold text-foreground">{displayVal}</span>
                  </div>
                );
              })}
            </div>
          );
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-card border border-border rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
              
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-border/80 flex items-center justify-between bg-secondary/15">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-primary">TRADE EXECUTION REPORT</h3>
                  <span className="text-[10px] font-mono text-muted-foreground/80">{selectedTrade.id}</span>
                </div>
                <button 
                  onClick={() => setSelectedTrade(null)} 
                  className="p-1 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Scrollable Body */}
              <div className="p-6 overflow-y-auto space-y-6">
                
                {/* Section 1: Trade Overview */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-muted-foreground border-b border-border/40 pb-1">Section 1: Trade Overview</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 bg-secondary/30 border border-border rounded-xl">
                    <div>
                      <span className="text-[9px] font-black uppercase text-muted-foreground block">Asset</span>
                      <span className="font-extrabold text-sm text-foreground">{selectedTrade.symbol}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black uppercase text-muted-foreground block">Side</span>
                      <span className={`font-extrabold text-sm uppercase ${selectedTrade.direction === "LONG" ? "text-emerald-500" : "text-destructive"}`}>
                        {selectedTrade.direction}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black uppercase text-muted-foreground block">Strategy</span>
                      <span className="font-extrabold text-sm text-foreground block truncate" title={selectedTrade.strategyName}>
                        {selectedTrade.strategyName}
                      </span>
                      {selectedTrade.strategyCategory && (
                        <span className="text-[9px] font-bold text-muted-foreground uppercase bg-secondary px-1.5 py-0.5 rounded border border-border">
                          {selectedTrade.strategyCategory}
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-[9px] font-black uppercase text-muted-foreground block">Status</span>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase border mt-0.5 ${
                        selectedTrade.status === "OPEN" 
                          ? "bg-primary/10 text-primary border-primary/20 animate-pulse"
                          : selectedTrade.status === "TP HIT"
                          ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                          : selectedTrade.status === "STOPPED"
                          ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                          : "bg-secondary text-muted-foreground border-border"
                      }`}>
                        {selectedTrade.status}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black uppercase text-muted-foreground block">PnL</span>
                      <span className={`font-extrabold text-sm ${selectedTrade.pnl >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                        {selectedTrade.pnl >= 0 ? "+" : ""}${selectedTrade.pnl.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black uppercase text-muted-foreground block">ROI</span>
                      <span className={`font-extrabold text-sm ${selectedTrade.pnl >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                        {selectedTrade.roi.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Section 2: Entry Analysis */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-muted-foreground border-b border-border/40 pb-1">Section 2: Entry Analysis</h4>
                  <div className="bg-secondary/15 border border-border/60 rounded-xl p-4 space-y-3 text-xs">
                    <div>
                      <span className="text-[9px] font-black uppercase text-muted-foreground block mb-1">Entry Reason</span>
                      <p className="font-semibold text-foreground bg-card border border-border p-2.5 rounded-lg leading-relaxed">
                        {selectedTrade.entryReason || "Central Engine hardcoded/generic execution signal."}
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[9px] font-black uppercase text-muted-foreground block mb-1">Confidence Score</span>
                        <div className="flex items-center gap-2">
                          <div className="w-full bg-secondary rounded-full h-2 max-w-[120px]">
                            <div 
                              className="bg-primary h-2 rounded-full" 
                              style={{ width: `${selectedTrade.confidence}%` }}
                            ></div>
                          </div>
                          <span className="font-extrabold text-foreground">{selectedTrade.confidence.toFixed(0)}%</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-[9px] font-black uppercase text-muted-foreground block mb-1">Market Regime</span>
                        <span className="font-extrabold text-foreground bg-secondary px-2.5 py-1 rounded-lg border border-border inline-block">
                          {selectedTrade.marketRegime || "UNKNOWN"}
                        </span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[9px] font-black uppercase text-muted-foreground block mb-1.5">Indicator Snapshot at Entry</span>
                      {renderIndicatorSnapshot(indicatorsObj)}
                    </div>
                  </div>
                </div>

                {/* Section 3: Exit Analysis */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-muted-foreground border-b border-border/40 pb-1">Section 3: Exit Analysis</h4>
                  <div className="bg-secondary/15 border border-border/60 rounded-xl p-4 space-y-3 text-xs">
                    <div>
                      <span className="text-[9px] font-black uppercase text-muted-foreground block mb-1">Exit Reason</span>
                      <p className="font-semibold text-foreground bg-card border border-border p-2.5 rounded-lg">
                        {selectedTrade.exitReason || (selectedTrade.status === "OPEN" ? "Position is currently active." : "Position closed manually by user.")}
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[9px] font-black uppercase text-muted-foreground block">Exit Timestamp</span>
                        <span className="font-bold text-foreground">
                          {selectedTrade.closedAt ? selectedTrade.closedAt.toLocaleString() : "N/A (Active)"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-black uppercase text-muted-foreground block">Trade Duration</span>
                        <span className="font-bold text-foreground">
                          {formatDuration(selectedTrade.openedAt, selectedTrade.closedAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 4: Risk Metrics */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-muted-foreground border-b border-border/40 pb-1">Section 4: Risk Metrics</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                    <div className="flex justify-between border-b border-border/20 py-1.5">
                      <span className="text-muted-foreground font-medium">Quantity</span>
                      <span className="font-bold text-foreground">{selectedTrade.quantity.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>
                    </div>
                    <div className="flex justify-between border-b border-border/20 py-1.5">
                      <span className="text-muted-foreground font-medium">Entry Price</span>
                      <span className="font-bold text-foreground">${selectedTrade.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between border-b border-border/20 py-1.5">
                      <span className="text-muted-foreground font-medium">Exit / Current Price</span>
                      <span className="font-bold text-foreground">${selectedTrade.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between border-b border-border/20 py-1.5">
                      <span className="text-muted-foreground font-medium">Stop Loss</span>
                      <span className="font-bold text-amber-500/90">{selectedTrade.stopLoss ? `$${selectedTrade.stopLoss.toLocaleString()}` : "None"}</span>
                    </div>
                    <div className="flex justify-between border-b border-border/20 py-1.5">
                      <span className="text-muted-foreground font-medium">Take Profit</span>
                      <span className="font-bold text-emerald-500/90">{selectedTrade.takeProfit ? `$${selectedTrade.takeProfit.toLocaleString()}` : "None"}</span>
                    </div>
                    <div className="flex justify-between border-b border-border/20 py-1.5">
                      <span className="text-primary font-bold">R Multiple</span>
                      <span className="font-black text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                        {calculateRMultiple(selectedTrade)}
                      </span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-border bg-secondary/10 flex justify-end">
                <button 
                  onClick={() => setSelectedTrade(null)} 
                  className="px-4 py-2 bg-primary hover:bg-primary/95 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer"
                >
                  Close Audit View
                </button>
              </div>

            </div>
          </div>
        );
      })()}

    </div>
  );
}
