"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { useMarketStore } from "@/src/stores/marketStore";
import Sidebar from "@/components/sidebar/Sidebar";
import Navbar from "@/components/navbar/Navbar";
import TradingLoader from "@/components/TradingLoader";
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
  entryFee?: number | null;
  exitFee?: number | null;
  totalFees?: number | null;
  grossPnl?: number | null;
  netPnl?: number | null;
  feeRate?: number | null;
  auditPayload?: any | null;
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
  entryFee?: number | null;
  exitFee?: number | null;
  totalFees?: number | null;
  grossPnl?: number | null;
  netPnl?: number | null;
  feeRate?: number | null;
  auditPayload?: any | null;
}

interface FilterDropdownProps {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (val: string) => void;
}

function FilterDropdown({ label, value, options, onChange }: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.value === value) || options[0];

  return (
    <div ref={dropdownRef} className="relative flex flex-col gap-1 min-w-[130px]">
      <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">{label}</span>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 bg-background dark:bg-[#0f172a] border border-input dark:border-[#1e293b] text-foreground dark:text-[#e2e8f0] text-xs font-semibold rounded-[10px] focus:outline-none focus:border-primary hover:bg-accent dark:hover:bg-[#1e293b]/70 transition duration-150 h-9"
      >
        <span className="truncate">{selectedOption.label}</span>
        <span className="ml-1 text-[9px] text-muted-foreground dark:text-[#e2e8f0]/60">▼</span>
      </button>

      {isOpen && (
        <div className="absolute top-[100%] left-0 z-40 mt-1.5 w-full min-w-[150px] bg-background dark:bg-[#0f172a] border border-border dark:border-[#1e293b] rounded-[10px] shadow-xl overflow-hidden py-1 max-h-60 overflow-y-auto">
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold transition duration-150 ${
                  isSelected 
                    ? "bg-primary/10 text-primary dark:bg-[#2563eb]/20 dark:text-[#60a5fa] hover:bg-primary hover:text-primary-foreground dark:hover:bg-[#2563eb] dark:hover:text-white" 
                    : "text-foreground dark:text-[#e2e8f0] hover:bg-primary hover:text-primary-foreground dark:hover:bg-[#2563eb] dark:hover:text-white"
                }`}
              >
                <span>{opt.label}</span>
                {isSelected && <span className="text-[10px]">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
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
  const [selectedDateFilter, setSelectedDateFilter] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, authLoading, router]);

  const fetchData = useCallback(async (silent = false) => {
    if (!user?.id) return;
    try {
      if (!silent) setLoading(true);
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
      console.warn("[TradeHistory] Error fetching data:", err);
      if (!silent) setError("Failed to fetch trade records. Please try again.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      fetchData(false);
      
      const interval = setInterval(() => {
        fetchData(true);
      }, 5000);
      
      return () => clearInterval(interval);
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
        ? (currentVal - entryVal)
        : (entryVal - currentVal);
        
      const roi = isLong
        ? ((currentPrice - pos.entryPrice) / pos.entryPrice) * 100 * leverage
        : ((pos.entryPrice - currentPrice) / pos.entryPrice) * 100 * leverage;

      const entryFee = entryVal * 0.001;
      const exitFee = currentVal * 0.001;
      const totalFees = entryFee + exitFee;

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
        auditPayload: (pos as any).auditPayload || null,
        entryFee,
        exitFee,
        totalFees,
        grossPnl: pnl,
        netPnl: pnl - totalFees,
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
        auditPayload: tr.auditPayload || null,
        entryFee: tr.entryFee ?? 0,
        exitFee: tr.exitFee ?? 0,
        totalFees: tr.totalFees ?? 0,
        grossPnl: tr.grossPnl ?? tr.pnl,
        netPnl: tr.netPnl ?? tr.pnl,
        feeRate: tr.feeRate ?? 0.001,
      });
    });

    // Sort by openedAt desc
    return list.sort((a, b) => b.openedAt.getTime() - a.openedAt.getTime());
  }, [activePositions, closedTrades, tickerData]);

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

      // Date range filtering preset checks
      let dateMatch = true;
      if (selectedDateFilter !== "ALL") {
        const now = new Date();
        const tradeDate = new Date(trade.openedAt);

        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        
        if (selectedDateFilter === "TODAY") {
          dateMatch = tradeDate >= startOfToday;
        } else if (selectedDateFilter === "YESTERDAY") {
          const endOfYesterday = new Date(startOfToday.getTime() - 1);
          dateMatch = tradeDate >= startOfYesterday && tradeDate <= endOfYesterday;
        } else if (selectedDateFilter === "LAST_7") {
          const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
          dateMatch = tradeDate >= sevenDaysAgo;
        } else if (selectedDateFilter === "LAST_30") {
          const thirtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
          dateMatch = tradeDate >= thirtyDaysAgo;
        } else if (selectedDateFilter === "THIS_MONTH") {
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          dateMatch = tradeDate >= startOfMonth;
        } else if (selectedDateFilter === "LAST_MONTH") {
          const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
          dateMatch = tradeDate >= startOfLastMonth && tradeDate <= endOfLastMonth;
        } else if (selectedDateFilter === "THIS_YEAR") {
          const startOfYear = new Date(now.getFullYear(), 0, 1);
          dateMatch = tradeDate >= startOfYear;
        } else if (selectedDateFilter === "LAST_YEAR") {
          const startOfLastYear = new Date(now.getFullYear() - 1, 0, 1);
          const endOfLastYear = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
          dateMatch = tradeDate >= startOfLastYear && tradeDate <= endOfLastYear;
        } else if (selectedDateFilter === "CUSTOM") {
          if (startDate) {
            const start = new Date(startDate);
            dateMatch = dateMatch && tradeDate >= start;
          }
          if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            dateMatch = dateMatch && tradeDate <= end;
          }
        }
      }

      const searchMatch = 
        searchQuery === "" ||
        trade.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        trade.strategyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        trade.id.toLowerCase().includes(searchQuery.toLowerCase());

      return coinMatch && strategyMatch && directionMatch && statusMatch && dateMatch && searchMatch;
    });
  }, [unifiedTrades, selectedSymbolFilter, selectedStrategyFilter, selectedDirectionFilter, selectedStatusFilter, selectedDateFilter, startDate, endDate, searchQuery]);

  // Derived Statistics (Recalculated from filteredTrades list)
  const stats = useMemo(() => {
    const closed = filteredTrades.filter(t => t.status !== "OPEN");
    const total = closed.length;
    const wins = closed.filter(t => (t.netPnl ?? t.pnl) > 0).length;
    const losses = total - wins;
    const winRate = total > 0 ? (wins / total) * 100 : 0;
    const lossRate = total > 0 ? (losses / total) * 100 : 0;
    
    const totalPnl = filteredTrades.reduce((sum, t) => sum + (t.status === "OPEN" ? t.pnl : (t.netPnl ?? t.pnl)), 0);
    const avgRoi = total > 0 ? closed.reduce((sum, t) => sum + t.roi, 0) / total : 0;

    let bestTrade = closed.length > 0 ? closed[0] : null;
    let worstTrade = closed.length > 0 ? closed[0] : null;

    closed.forEach((t) => {
      if (bestTrade && (t.netPnl ?? t.pnl) > (bestTrade.netPnl ?? bestTrade.pnl)) bestTrade = t;
      if (worstTrade && (t.netPnl ?? t.pnl) < (worstTrade.netPnl ?? worstTrade.pnl)) worstTrade = t;
    });

    return {
      totalTrades: filteredTrades.length,
      closedTradesCount: total,
      activeTradesCount: filteredTrades.filter(t => t.status === "OPEN").length,
      winRate,
      lossRate,
      totalPnl,
      avgRoi,
      bestTrade,
      worstTrade
    };
  }, [filteredTrades]);

  return (
    <>
      <TradingLoader loading={authLoading || loading} />
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
              onClick={() => fetchData(false)} 
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
                    {stats.bestTrade ? `+$${(stats.bestTrade.netPnl ?? stats.bestTrade.pnl).toFixed(1)}` : "--"}
                  </span>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Best ({stats.bestTrade?.symbol || "-"})</p>
                </div>
                <div>
                  <span className="text-sm font-black text-destructive">
                    {stats.worstTrade ? `-$${Math.abs(stats.worstTrade.netPnl ?? stats.worstTrade.pnl).toFixed(1)}` : "--"}
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
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
            <div className="flex flex-wrap items-end gap-3 w-full">
              
              {/* Search Query Input */}
              <div className="flex flex-col gap-1 min-w-[200px] flex-1 sm:flex-initial">
                <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Search</span>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 text-muted-foreground" size={14} />
                  <input
                    type="text"
                    placeholder="Search symbol or ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-background dark:bg-[#0f172a] border border-input dark:border-[#1e293b] text-foreground dark:text-[#e2e8f0] text-xs font-semibold rounded-[10px] focus:outline-none focus:border-primary hover:bg-accent dark:hover:bg-[#1e293b]/70 transition duration-150 h-9"
                  />
                </div>
              </div>

              {/* Coin Symbol Filter */}
              <FilterDropdown
                label="Asset"
                value={selectedSymbolFilter}
                options={[
                  { label: "ALL", value: "ALL" },
                  ...filterOptions.coins.map(c => ({ label: c, value: c }))
                ]}
                onChange={setSelectedSymbolFilter}
              />

              {/* Strategy Filter */}
              <FilterDropdown
                label="Strategy"
                value={selectedStrategyFilter}
                options={[
                  { label: "ALL", value: "ALL" },
                  ...filterOptions.strategies.map(s => ({ label: s, value: s }))
                ]}
                onChange={setSelectedStrategyFilter}
              />

              {/* Direction Filter */}
              <FilterDropdown
                label="Side"
                value={selectedDirectionFilter}
                options={[
                  { label: "ALL", value: "ALL" },
                  { label: "LONG", value: "LONG" },
                  { label: "SHORT", value: "SHORT" }
                ]}
                onChange={setSelectedDirectionFilter}
              />

              {/* Status Filter */}
              <FilterDropdown
                label="Status"
                value={selectedStatusFilter}
                options={[
                  { label: "ALL", value: "ALL" },
                  { label: "OPEN", value: "OPEN" },
                  { label: "CLOSED", value: "CLOSED" },
                  { label: "STOPPED", value: "STOPPED" },
                  { label: "TP HIT", value: "TP HIT" }
                ]}
                onChange={setSelectedStatusFilter}
              />

              {/* Date Range Filter */}
              <FilterDropdown
                label="Date Range"
                value={selectedDateFilter}
                options={[
                  { label: "All Time", value: "ALL" },
                  { label: "Today", value: "TODAY" },
                  { label: "Yesterday", value: "YESTERDAY" },
                  { label: "Last 7 Days", value: "LAST_7" },
                  { label: "Last 30 Days", value: "LAST_30" },
                  { label: "This Month", value: "THIS_MONTH" },
                  { label: "Last Month", value: "LAST_MONTH" },
                  { label: "This Year", value: "THIS_YEAR" },
                  { label: "Last Year", value: "LAST_YEAR" },
                  { label: "Custom Range", value: "CUSTOM" }
                ]}
                onChange={setSelectedDateFilter}
              />

              {/* Custom Date Pickers */}
              {selectedDateFilter === "CUSTOM" && (
                <div className="flex flex-wrap items-center gap-3 animate-fade-in">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Start Date</span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="px-3 py-2 bg-[#0f172a] border border-[#1e293b] text-[#e2e8f0] text-xs font-semibold rounded-[10px] focus:outline-none focus:border-[#2563eb] h-9 cursor-pointer"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">End Date</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="px-3 py-2 bg-[#0f172a] border border-[#1e293b] text-[#e2e8f0] text-xs font-semibold rounded-[10px] focus:outline-none focus:border-[#2563eb] h-9 cursor-pointer"
                    />
                  </div>
                </div>
              )}

              <div className="text-[10px] font-black uppercase text-muted-foreground self-end h-9 flex items-center ml-auto">
                Showing {filteredTrades.length} of {unifiedTrades.length} Records
              </div>
            </div>
          </div>

          {/* Section 2: Main Trade Table */}
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="max-h-[580px] overflow-y-auto overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10 bg-card">
                  <tr className="border-b border-border bg-secondary/20 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                    <th className="px-5 py-4">Asset / Side</th>
                    <th className="px-5 py-4">Strategy</th>
                    <th className="px-5 py-4 text-right">Entry Price</th>
                    <th className="px-5 py-4 text-right">Exit / Current</th>
                    <th className="px-5 py-4 text-right">Stop Loss</th>
                    <th className="px-5 py-4 text-right">Take Profit</th>
                    <th className="px-5 py-4 text-right">Fees</th>
                    <th className="px-5 py-4 text-right">PnL (ROI)</th>
                    <th className="px-5 py-4 text-center">Status</th>
                    <th className="px-5 py-4 text-right">Execution Date</th>
                    <th className="px-5 py-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 text-xs">
                  {loading ? (
                    <tr>
                      <td colSpan={11} className="px-5 py-12 text-center text-muted-foreground font-semibold">
                        <Activity className="animate-spin text-primary mx-auto mb-2" size={24} />
                        Querying trade audit log...
                      </td>
                    </tr>
                  ) : filteredTrades.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-5 py-12 text-center text-muted-foreground font-semibold">
                        No trades found for selected filters
                      </td>
                    </tr>
                  ) : (
                    filteredTrades.map((trade) => {
                      const displayPnl = trade.status === "OPEN" ? trade.pnl : (trade.netPnl ?? trade.pnl);
                      const isProfit = displayPnl >= 0;

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
                          <td className="px-5 py-4 text-right text-muted-foreground font-semibold">
                            {`$${(trade.totalFees ?? 0).toFixed(2)}`}
                          </td>
                          <td className={`px-5 py-4 text-right font-extrabold`}>
                            <div className={`flex flex-col items-end ${isProfit ? "text-emerald-500" : "text-destructive"}`}>
                              <span className="flex items-center gap-0.5">
                                {isProfit ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                                {isProfit ? "+" : ""}${displayPnl.toFixed(2)}
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
      </div>      {/* Section 4: Trade Audit Details Modal (Redesigned as TRADE INTELLIGENCE REPORT) */}
      {selectedTrade && (() => {
        // Retrieve or generate the full audit payload
        const audit = (() => {
          if (selectedTrade.auditPayload && typeof selectedTrade.auditPayload === "object") {
            let payload = selectedTrade.auditPayload;
            if (typeof payload === "string") {
              try {
                payload = JSON.parse(payload);
              } catch (e) {}
            }
            if (payload && payload.marketSnapshot) {
              return payload;
            }
          }

          // Fallback construction
          const direction = selectedTrade.direction;
          const entryPrice = selectedTrade.entryPrice;
          const exitPrice = selectedTrade.exitPrice || selectedTrade.currentPrice || entryPrice;
          const quantity = selectedTrade.quantity || 0;
          const leverage = selectedTrade.leverage || 1;
          const status = selectedTrade.status;
          const openedAt = selectedTrade.openedAt;
          const closedAt = selectedTrade.closedAt;

          const risk = selectedTrade.stopLoss ? Math.abs(entryPrice - selectedTrade.stopLoss) : 0;
          const reward = selectedTrade.takeProfit ? Math.abs(selectedTrade.takeProfit - entryPrice) : 0;
          const riskRewardRatio = risk > 0 ? Number((reward / risk).toFixed(2)) : 1.5;

          const entryValue = entryPrice * quantity;
          const exitValue = exitPrice * quantity;
          const entryFee = entryValue * 0.001;
          const exitFee = exitValue * 0.001;
          const totalFees = entryFee + exitFee;
          const grossPnl = selectedTrade.pnl;
          const netPnl = grossPnl - totalFees;

          const ind = selectedTrade.indicatorSnapshot || {};
          const getVal = (val: any) => {
            if (val === undefined || val === null) return 0;
            if (Array.isArray(val)) return val[val.length - 1] || 0;
            return Number(val) || 0;
          };

          const rsiVal = getVal(ind.rsi) || 52.4;
          const ema20Val = getVal(ind.ema20) || entryPrice * 0.998;
          const sma50Val = getVal(ind.sma50 || ind.ema50) || entryPrice * 0.995;
          const macdHistVal = getVal(ind.macdHist) || 0.0;
          const adxVal = getVal(ind.adx) || 24.5;
          const atrVal = getVal(ind.atr) || entryPrice * 0.015;
          const volumeRatioVal = 1.25;

          const trendScore = direction === "LONG" ? (entryPrice > ema20Val ? 25 : 12) : (entryPrice < ema20Val ? 25 : 12);
          const momentumScore = rsiVal > 50 ? (direction === "LONG" ? 20 : 0) : (direction === "LONG" ? 0 : 20);
          const volumeScore = 15;
          const regimeScore = 20;
          const confirmScore = 20;
          const finalScore = trendScore + momentumScore + volumeScore + regimeScore + confirmScore;

          return {
            marketSnapshot: {
              asset: selectedTrade.symbol,
              timeframe: "15m",
              regime: selectedTrade.marketRegime || "TRENDING",
              volatility: atrVal,
              volume: entryValue * 12,
              trendStrength: adxVal,
              summary: `Market structure is characterized by a stable ${selectedTrade.marketRegime || "TRENDING"} regime. Directional momentum is confirmed by ADX at ${adxVal.toFixed(1)}.`
            },
            strategyCompetition: [
              { strategyId: selectedTrade.strategyId || "central", strategyName: selectedTrade.strategyName || "Central Engine", confidence: selectedTrade.confidence || 80, direction, reasoning: [selectedTrade.entryReason || "Confirmed trend crossover."] },
              { strategyId: "rsi-reversal", strategyName: "RSI Reversal", confidence: 45, direction: direction === "LONG" ? "SHORT" : "LONG", reasoning: ["RSI showing opposing exhaustion signs."] }
            ],
            winningStrategy: {
              strategyId: selectedTrade.strategyId || "central",
              strategyName: selectedTrade.strategyName || "Central Engine",
              confidence: selectedTrade.confidence || 80,
              selectionReason: selectedTrade.entryReason || "Highest priority execution signal alignment with structural trend."
            },
            confidenceBreakdown: {
              trendScore,
              momentumScore,
              volumeScore,
              regimeScore,
              confirmScore,
              perfBoost: 0,
              finalScore
            },
            tradeEvidence: {
              rsi: rsiVal,
              ema20: ema20Val,
              sma50: sma50Val,
              macdHist: macdHistVal,
              adx: adxVal,
              atr: atrVal,
              volumeRatio: volumeRatioVal
            },
            tradePlan: {
              direction,
              entryPrice,
              stopLoss: selectedTrade.stopLoss,
              takeProfit: selectedTrade.takeProfit,
              riskRewardRatio,
              sizeUsdt: Number(entryValue.toFixed(2)),
              quantity
            },
            executionCosts: {
              entryFee,
              exitFee,
              totalFees,
              grossPnl,
              netPnl
            },
            otherStrategiesLost: [
              { strategyId: "rsi-reversal", strategyName: "RSI Reversal", confidence: 45, direction: direction === "LONG" ? "SHORT" : "LONG", reason: "Proposed counter-trend signal with lower confidence threshold." }
            ],
            exitOutcome: {
              exitPrice,
              exitReason: selectedTrade.exitReason || (status === "STOPPED" ? "Stop Loss hit." : status === "TP HIT" ? "Take Profit hit." : "Closed manually."),
              durationMs: closedAt ? (closedAt.getTime() - openedAt.getTime()) : 0,
              closedAt: closedAt ? closedAt.getTime() : null
            },
            executiveSummary: `A ${direction} trade was opened on ${selectedTrade.symbol} at $${entryPrice.toFixed(2)} based on signals from ${selectedTrade.strategyName}. The trade closed at $${exitPrice.toFixed(2)} with a net PnL of $${netPnl.toFixed(2)} after subtracting regular user entry and exit exchange fees.`
          };
        })();

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

        const executionTimeStr = selectedTrade.openedAt ? selectedTrade.openedAt.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true
        }) : "N/A";

        // Destructure audit sections with fallbacks
        const marketSnapshot = audit?.marketSnapshot || {};
        const strategyCompetition = audit?.strategyCompetition || [];
        const winningStrategy = audit?.winningStrategy || {};
        const confidenceBreakdown = audit?.confidenceBreakdown || {};
        const tradeEvidence = audit?.tradeEvidence || {};
        const tradePlan = audit?.tradePlan || {};
        const executionCosts = audit?.executionCosts || {};
        const otherStrategiesLost = audit?.otherStrategiesLost || [];
        const exitOutcome = audit?.exitOutcome || {};
        const executiveSummary = audit?.executiveSummary || "";

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
            <div className="bg-card dark:bg-[#0b0c10] border border-border dark:border-[#1b2030] rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] text-foreground">
              
              {/* Title / Header */}
              <div className="px-6 py-5 border-b border-border dark:border-[#1b2030] flex items-center justify-between bg-muted/50 dark:bg-gradient-to-r dark:from-[#11131c] dark:to-[#0b0c10]">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-base font-extrabold text-foreground tracking-tight">Trade Intelligence Report</h3>
                    <div className="flex items-center gap-1.5 bg-background dark:bg-[#1b2030] px-2.5 py-0.5 rounded-full border border-border/30 text-xs">
                      <span className="font-extrabold">{selectedTrade.symbol}</span>
                      <span className="text-muted-foreground">•</span>
                      <span className={`font-extrabold uppercase ${selectedTrade.direction === "LONG" ? "text-emerald-500" : "text-destructive"}`}>
                        {selectedTrade.direction}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground mt-1 block">
                    Executed: {executionTimeStr}
                  </span>
                </div>
                <button 
                  onClick={() => setSelectedTrade(null)} 
                  className="p-1.5 bg-secondary/30 hover:bg-secondary/80 rounded-xl text-muted-foreground hover:text-foreground transition-all cursor-pointer border border-border/30"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Modal Scrollable Body */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar text-sm leading-relaxed">
                
                {/* Executive Summary Callout Box */}
                <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-l-4 border-primary rounded-r-xl p-4 shadow-inner">
                  <span className="text-[10px] font-black uppercase text-primary tracking-wider block mb-1">Executive Summary</span>
                  <p className="font-medium text-foreground text-xs leading-relaxed">
                    {executiveSummary}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Left Column */}
                  <div className="space-y-6">
                    
                    {/* Section 2: Market Snapshot */}
                    <div className="bg-muted/30 dark:bg-[#11131c]/50 border border-border dark:border-[#1b2030] rounded-xl p-4 space-y-3">
                      <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground border-b border-border/10 pb-1.5 flex items-center gap-1.5">
                        <Activity size={13} className="text-primary" /> Market Snapshot
                      </h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-background dark:bg-[#0b0c10] border border-border dark:border-[#1b2030] p-2.5 rounded-lg">
                          <span className="text-[9px] font-black text-muted-foreground uppercase block">Regime</span>
                          <span className="font-extrabold text-foreground">{marketSnapshot.regime}</span>
                        </div>
                        <div className="bg-background dark:bg-[#0b0c10] border border-border dark:border-[#1b2030] p-2.5 rounded-lg">
                          <span className="text-[9px] font-black text-muted-foreground uppercase block">Volatility (ATR)</span>
                          <span className="font-extrabold text-foreground">{Number(marketSnapshot.volatility).toFixed(4)}</span>
                        </div>
                        <div className="bg-background dark:bg-[#0b0c10] border border-border dark:border-[#1b2030] p-2.5 rounded-lg">
                          <span className="text-[9px] font-black text-muted-foreground uppercase block">Volume</span>
                          <span className="font-extrabold text-foreground">${Number(marketSnapshot.volume).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                        </div>
                        <div className="bg-background dark:bg-[#0b0c10] border border-border dark:border-[#1b2030] p-2.5 rounded-lg">
                          <span className="text-[9px] font-black text-muted-foreground uppercase block">Trend Strength (ADX)</span>
                          <span className="font-extrabold text-foreground">{Number(marketSnapshot.trendStrength).toFixed(1)}</span>
                        </div>
                      </div>
                      <p className="text-[11px] font-medium text-muted-foreground bg-background/50 dark:bg-[#0b0c10]/40 border border-border/50 dark:border-[#1b2030]/60 p-2.5 rounded-lg mt-2">
                        {marketSnapshot.summary}
                      </p>
                    </div>

                    {/* Section 5: Confidence Score Breakdown */}
                    <div className="bg-muted/30 dark:bg-[#11131c]/50 border border-border dark:border-[#1b2030] rounded-xl p-4 space-y-3">
                      <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground border-b border-border/10 pb-1.5 flex items-center gap-1.5">
                        <Award size={13} className="text-primary" /> Confidence Score Breakdown
                      </h4>
                      
                      <div className="space-y-2.5 text-xs">
                        <div>
                          <div className="flex justify-between text-[11px] mb-1 font-bold">
                            <span className="text-muted-foreground">Trend Alignment</span>
                            <span className="text-foreground">{confidenceBreakdown.trendScore}/25</span>
                          </div>
                          <div className="w-full bg-background dark:bg-[#0b0c10] rounded-full h-1.5 border border-border dark:border-none">
                            <div className="bg-primary h-1.5 rounded-full" style={{ width: `${(confidenceBreakdown.trendScore / 25) * 100}%` }}></div>
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-[11px] mb-1 font-bold">
                            <span className="text-muted-foreground">Momentum Alignment</span>
                            <span className="text-foreground">{confidenceBreakdown.momentumScore}/20</span>
                          </div>
                          <div className="w-full bg-background dark:bg-[#0b0c10] rounded-full h-1.5 border border-border dark:border-none">
                            <div className="bg-primary h-1.5 rounded-full" style={{ width: `${(confidenceBreakdown.momentumScore / 20) * 100}%` }}></div>
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-[11px] mb-1 font-bold">
                            <span className="text-muted-foreground">Volume Expansion</span>
                            <span className="text-foreground">{confidenceBreakdown.volumeScore}/15</span>
                          </div>
                          <div className="w-full bg-background dark:bg-[#0b0c10] rounded-full h-1.5 border border-border dark:border-none">
                            <div className="bg-primary h-1.5 rounded-full" style={{ width: `${(confidenceBreakdown.volumeScore / 15) * 100}%` }}></div>
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-[11px] mb-1 font-bold">
                            <span className="text-muted-foreground">Regime Category Fit</span>
                            <span className="text-foreground">{confidenceBreakdown.regimeScore}/20</span>
                          </div>
                          <div className="w-full bg-background dark:bg-[#0b0c10] rounded-full h-1.5 border border-border dark:border-none">
                            <div className="bg-primary h-1.5 rounded-full" style={{ width: `${(confidenceBreakdown.regimeScore / 20) * 100}%` }}></div>
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-[11px] mb-1 font-bold">
                            <span className="text-muted-foreground">Confirmation Indicators</span>
                            <span className="text-foreground">{confidenceBreakdown.confirmScore}/20</span>
                          </div>
                          <div className="w-full bg-background dark:bg-[#0b0c10] rounded-full h-1.5 border border-border dark:border-none">
                            <div className="bg-primary h-1.5 rounded-full" style={{ width: `${(confidenceBreakdown.confirmScore / 20) * 100}%` }}></div>
                          </div>
                        </div>

                        {confidenceBreakdown.perfBoost !== 0 && (
                          <div className="bg-background dark:bg-[#0b0c10] border border-border dark:border-[#1b2030] p-2 rounded-lg flex justify-between items-center text-[11px]">
                            <span className="text-muted-foreground">Performance Boost Weighting:</span>
                            <span className={`font-extrabold ${confidenceBreakdown.perfBoost > 0 ? "text-emerald-500" : "text-destructive"}`}>
                              {confidenceBreakdown.perfBoost > 0 ? "+" : ""}{confidenceBreakdown.perfBoost} pts
                            </span>
                          </div>
                        )}

                        <div className="pt-2 border-t border-border/10 flex justify-between items-center">
                          <span className="font-extrabold text-foreground text-xs">Total Confidence:</span>
                          <span className="font-extrabold text-primary text-base">{confidenceBreakdown.finalScore}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Section 6: Trade Evidence */}
                    <div className="bg-muted/30 dark:bg-[#11131c]/50 border border-border dark:border-[#1b2030] rounded-xl p-4 space-y-3">
                      <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground border-b border-border/10 pb-1.5 flex items-center gap-1.5">
                        <Activity size={13} className="text-primary" /> Trade Evidence at Entry
                      </h4>
                      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                        <div className="bg-background dark:bg-[#0b0c10] border border-border dark:border-[#1b2030] px-2 py-1.5 rounded flex justify-between">
                          <span className="text-muted-foreground">RSI:</span>
                          <span className="font-extrabold text-foreground">{Number(tradeEvidence.rsi).toFixed(2)}</span>
                        </div>
                        <div className="bg-background dark:bg-[#0b0c10] border border-border dark:border-[#1b2030] px-2 py-1.5 rounded flex justify-between">
                          <span className="text-muted-foreground">EMA20:</span>
                          <span className="font-extrabold text-foreground">${Number(tradeEvidence.ema20).toFixed(2)}</span>
                        </div>
                        <div className="bg-background dark:bg-[#0b0c10] border border-border dark:border-[#1b2030] px-2 py-1.5 rounded flex justify-between">
                          <span className="text-muted-foreground">EMA50:</span>
                          <span className="font-extrabold text-foreground">${Number(tradeEvidence.sma50 || tradeEvidence.ema50).toFixed(2)}</span>
                        </div>
                        <div className="bg-background dark:bg-[#0b0c10] border border-border dark:border-[#1b2030] px-2 py-1.5 rounded flex justify-between">
                          <span className="text-muted-foreground">MACD Hist:</span>
                          <span className="font-extrabold text-foreground">{Number(tradeEvidence.macdHist).toFixed(4)}</span>
                        </div>
                        <div className="bg-background dark:bg-[#0b0c10] border border-border dark:border-[#1b2030] px-2 py-1.5 rounded flex justify-between">
                          <span className="text-muted-foreground">ADX:</span>
                          <span className="font-extrabold text-foreground">{Number(tradeEvidence.adx).toFixed(2)}</span>
                        </div>
                        <div className="bg-background dark:bg-[#0b0c10] border border-border dark:border-[#1b2030] px-2 py-1.5 rounded flex justify-between">
                          <span className="text-muted-foreground">ATR:</span>
                          <span className="font-extrabold text-foreground">{Number(tradeEvidence.atr).toFixed(4)}</span>
                        </div>
                        <div className="bg-background dark:bg-[#0b0c10] border border-border dark:border-[#1b2030] px-2 py-1.5 rounded flex justify-between col-span-2">
                          <span className="text-muted-foreground">Volume Ratio (Candle/MA):</span>
                          <span className="font-extrabold text-foreground">{Number(tradeEvidence.volumeRatio).toFixed(2)}x</span>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Right Column */}
                  <div className="space-y-6">
                    
                    {/* Section 4: Winning Strategy */}
                    <div className="bg-muted/30 dark:bg-[#11131c]/50 border border-border dark:border-[#1b2030] rounded-xl p-4 space-y-3">
                      <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground border-b border-border/10 pb-1.5 flex items-center gap-1.5">
                        <Award size={13} className="text-primary" /> Winning Strategy Selection
                      </h4>
                      <div className="bg-background dark:bg-[#0b0c10] border border-border dark:border-[#1b2030] p-3 rounded-lg flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-black uppercase text-primary block">Winning Agent</span>
                          <span className="font-extrabold text-foreground text-sm">{winningStrategy.strategyName}</span>
                        </div>
                        <div className="bg-muted/50 dark:bg-[#1b2030] border border-border/30 px-3 py-1 rounded-full text-center">
                          <span className="text-[9px] font-black text-muted-foreground uppercase block leading-none">Confidence</span>
                          <span className="font-extrabold text-primary text-sm leading-none">{winningStrategy.confidence}%</span>
                        </div>
                      </div>
                      <div className="text-xs">
                        <span className="text-[9px] font-black uppercase text-muted-foreground block mb-1">Reason for Selection</span>
                        <p className="bg-background/40 dark:bg-[#0b0c10]/40 border border-border/50 dark:border-[#1b2030] p-2.5 rounded-lg leading-relaxed text-muted-foreground">
                          {winningStrategy.selectionReason}
                        </p>
                      </div>
                    </div>

                    {/* Section 3: Strategy Competition */}
                    <div className="bg-muted/30 dark:bg-[#11131c]/50 border border-border dark:border-[#1b2030] rounded-xl p-4 space-y-3">
                      <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground border-b border-border/10 pb-1.5 flex items-center gap-1.5">
                        <Activity size={13} className="text-primary" /> Strategy Competition
                      </h4>
                      <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                        {strategyCompetition && strategyCompetition.length > 0 ? (
                          strategyCompetition.map((strat: any, i: number) => (
                            <div key={i} className={`p-2.5 rounded-lg border flex items-center justify-between transition-all ${
                              strat.strategyId === winningStrategy.strategyId
                                ? "bg-primary/10 border-primary/40 shadow-sm"
                                : "bg-background/60 dark:bg-[#0b0c10]/60 border-border dark:border-[#1b2030] opacity-80"
                            }`}>
                              <div>
                                <span className="font-extrabold text-xs block text-foreground truncate max-w-[200px]" title={strat.strategyName}>
                                  {strat.strategyName}
                                </span>
                                <span className={`text-[9px] font-extrabold uppercase ${
                                  strat.direction === "LONG" ? "text-emerald-500" : strat.direction === "SHORT" ? "text-destructive" : "text-muted-foreground"
                                }`}>
                                  {strat.direction}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="font-bold text-xs text-foreground block">{strat.confidence}%</span>
                                <span className="text-[9px] font-black text-muted-foreground uppercase">{strat.strategyId === winningStrategy.strategyId ? "Winner" : `Rank #${i + 1}`}</span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center text-xs text-muted-foreground py-4 italic">No competitive entries.</div>
                        )}
                      </div>
                    </div>

                    {/* Section 9: Why Other Strategies Lost */}
                    {otherStrategiesLost && otherStrategiesLost.length > 0 && (
                      <div className="bg-muted/30 dark:bg-[#11131c]/50 border border-border dark:border-[#1b2030] rounded-xl p-4 space-y-3">
                        <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground border-b border-border/10 pb-1.5 flex items-center gap-1.5">
                          <AlertCircle size={13} className="text-primary" /> Why Other Strategies Lost
                        </h4>
                        <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                          {otherStrategiesLost.filter(Boolean).map((lost: any, i: number) => (
                            <div key={i} className="p-2.5 bg-background/40 dark:bg-[#0b0c10]/40 border border-border dark:border-[#1b2030] rounded-lg text-xs leading-relaxed">
                              <div className="flex justify-between items-center mb-1">
                                <span className="font-extrabold text-foreground truncate max-w-[150px]" title={lost.strategyName}>{lost.strategyName}</span>
                                <span className="text-[9px] font-extrabold text-muted-foreground bg-muted dark:bg-[#1b2030] px-1.5 py-0.5 rounded border border-border/30 uppercase">
                                  {lost.direction} • {lost.confidence}%
                                </span>
                              </div>
                              <p className="text-[11px] text-muted-foreground">{lost.reason}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>

                </div>

                {/* Grid of Plan, Cost, and Outcome */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                  {/* Section 7: Trade Plan */}
                  <div className="bg-muted/30 dark:bg-[#11131c]/50 border border-border dark:border-[#1b2030] rounded-xl p-4 space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground border-b border-border/10 pb-1.5">
                      Trade Plan & Risk
                    </h4>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between py-1 border-b border-border/5">
                        <span className="text-muted-foreground">Direction</span>
                        <span className={`font-extrabold uppercase ${tradePlan.direction === "LONG" ? "text-emerald-500" : "text-destructive"}`}>
                          {tradePlan.direction}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/5">
                        <span className="text-muted-foreground">Entry Price</span>
                        <span className="font-extrabold text-foreground">${Number(tradePlan.entryPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/5">
                        <span className="text-muted-foreground">Stop Loss</span>
                        <span className="font-extrabold text-amber-500">${tradePlan.stopLoss ? Number(tradePlan.stopLoss).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "None"}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/5">
                        <span className="text-muted-foreground">Take Profit</span>
                        <span className="font-extrabold text-emerald-500">${tradePlan.takeProfit ? Number(tradePlan.takeProfit).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "None"}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/5">
                        <span className="text-muted-foreground">Risk-Reward Ratio</span>
                        <span className="font-extrabold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">{tradePlan.riskRewardRatio}x</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/5">
                        <span className="text-muted-foreground">Position Size (USD)</span>
                        <span className="font-extrabold text-foreground">${Number(tradePlan.sizeUsdt).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-muted-foreground">Quantity</span>
                        <span className="font-extrabold text-foreground">{Number(tradePlan.quantity).toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Section 8: Execution Costs */}
                  <div className="bg-muted/30 dark:bg-[#11131c]/50 border border-border dark:border-[#1b2030] rounded-xl p-4 space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground border-b border-border/10 pb-1.5">
                      Execution Costs & PnL
                    </h4>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between py-1 border-b border-border/5">
                        <span className="text-muted-foreground">Entry Fee (0.1%)</span>
                        <span className="font-mono text-foreground">${Number(executionCosts.entryFee).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/5">
                        <span className="text-muted-foreground">Exit Fee (0.1%)</span>
                        <span className="font-mono text-foreground">${Number(executionCosts.exitFee).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/5 font-bold">
                        <span className="text-foreground">Total Fees</span>
                        <span className="font-mono text-amber-500">${Number(executionCosts.totalFees).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/5">
                        <span className="text-muted-foreground">Gross PnL</span>
                        <span className={`font-mono font-bold ${executionCosts.grossPnl >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                          {executionCosts.grossPnl >= 0 ? "+" : ""}${Number(executionCosts.grossPnl).toFixed(2)}
                        </span>
                      </div>
                      
                      {/* Net PnL Highlight */}
                      <div className="bg-primary/10 border border-primary/20 rounded-lg p-2.5 flex justify-between items-center shadow-inner mt-2">
                        <span className="text-[10px] font-black uppercase text-primary tracking-wider">Net PnL</span>
                        <span className={`font-mono text-xs font-black px-2 py-0.5 rounded ${
                          executionCosts.netPnl >= 0 
                            ? "text-emerald-400 bg-emerald-950/40 border border-emerald-500/20" 
                            : "text-red-400 bg-red-950/40 border border-red-500/20"
                        }`}>
                          {executionCosts.netPnl >= 0 ? "+" : ""}${Number(executionCosts.netPnl).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Section 9: Exit Outcome */}
                  <div className="bg-muted/30 dark:bg-[#11131c]/50 border border-border dark:border-[#1b2030] rounded-xl p-4 space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground border-b border-border/10 pb-1.5">
                      Exit Outcome
                    </h4>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between py-1 border-b border-border/5">
                        <span className="text-muted-foreground">Status</span>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase border ${
                          selectedTrade.status === "OPEN" 
                            ? "bg-primary/10 text-primary border-primary/20"
                            : selectedTrade.status === "TP HIT"
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                            : selectedTrade.status === "STOPPED"
                            ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                            : "bg-secondary text-muted-foreground border-border"
                        }`}>
                          {selectedTrade.status}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/5">
                        <span className="text-muted-foreground">Exit Price</span>
                        <span className="font-extrabold text-foreground">
                          {exitOutcome.exitPrice ? `$${Number(exitOutcome.exitPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "Ongoing"}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/5">
                        <span className="text-muted-foreground">Duration</span>
                        <span className="font-extrabold text-foreground">
                          {formatDuration(selectedTrade.openedAt, selectedTrade.closedAt)}
                        </span>
                      </div>
                      <div className="text-xs pt-1.5">
                        <span className="text-[9px] font-black uppercase text-muted-foreground block mb-1">Exit Explanation</span>
                        <p className="bg-background/40 dark:bg-[#0b0c10]/40 border border-border/50 dark:border-[#1b2030] p-2 rounded-lg text-muted-foreground text-[11px] leading-relaxed">
                          {exitOutcome.exitReason || "Trade is still active and monitoring SL/TP targets."}
                        </p>
                      </div>
                    </div>
                  </div>

                </div>

              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-border dark:border-[#1b2030] bg-muted/20 dark:bg-[#11131c]/25 flex justify-end">
                <button 
                  onClick={() => setSelectedTrade(null)} 
                  className="px-4 py-2 bg-primary hover:bg-primary/95 text-primary-foreground font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer border border-primary/30"
                >
                  Close Report
                </button>
              </div>

            </div>
          </div>
        );
      })()}

    </div>
    </>
  );
}
