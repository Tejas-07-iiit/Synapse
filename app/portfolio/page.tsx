"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { useMarketStore } from "@/src/stores/marketStore";
import { useWalletStore } from "@/src/stores/walletStore";
import Sidebar from "@/components/sidebar/Sidebar";
import Navbar from "@/components/navbar/Navbar";
import { useTheme } from "next-themes";
import TradingLoader from "@/components/TradingLoader";
import { 
  Briefcase, 
  ArrowUpRight, 
  ArrowDownRight,
  TrendingUp,
  Percent,
  DollarSign,
  Activity,
  Layers,
  Award,
  AlertTriangle,
  Info
} from "lucide-react";
import { createChart, AreaSeries, LineType, type IChartApi, type UTCTimestamp } from "lightweight-charts";

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
  strategyName?: string | null;
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
  pnl: number;
  roi: number;
  confidence: number;
  status: string;
  openedAt: string;
  closedAt: string;
  executionType: string;
  entryFee?: number;
  exitFee?: number;
  totalFees?: number;
  grossPnl?: number;
  netPnl?: number;
  feeRate?: number;
}

interface FilterDropdownProps {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (val: string) => void;
}

function FilterDropdown({ label, value, options, onChange }: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
    <div ref={dropdownRef} className="relative flex flex-col gap-1 min-w-[140px]">
      <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">{label}</span>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 bg-card border border-border text-foreground text-xs font-semibold rounded-[10px] focus:outline-none focus:border-primary hover:bg-secondary/70 transition duration-150 h-9"
      >
        <span className="truncate">{selectedOption.label}</span>
        <span className="ml-1 text-[9px] text-foreground/60">▼</span>
      </button>

      {isOpen && (
        <div className="absolute top-[100%] left-0 z-40 mt-1.5 w-full min-w-[150px] bg-card border border-border rounded-[10px] shadow-xl overflow-hidden py-1 max-h-60 overflow-y-auto">
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
                className={`w-full text-left px-3 py-2 text-xs font-semibold transition duration-150 ${
                  isSelected 
                    ? "bg-primary text-primary-foreground" 
                    : "text-foreground hover:bg-secondary"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function PortfolioPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuthStore();
  const tickerData = useMarketStore((state) => state.tickerData);
  const wallet = useWalletStore((state) => state);
  const { resolvedTheme } = useTheme();

  const [activePositions, setActivePositions] = useState<DbPosition[]>([]);
  const [closedTrades, setClosedTrades] = useState<DbTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters State
  const [selectedDateFilter, setSelectedDateFilter] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<IChartApi | null>(null);
  const seriesInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, authLoading, router]);

  const fetchPortfolioData = useCallback(async (silent = false) => {
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

      await useWalletStore.getState().fetchWallet(user.id, silent);
      setError(null);
    } catch (err) {
      console.error("[Portfolio] Error fetching data:", err);
      if (!silent) setError("Failed to fetch portfolio data. Please try again.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      fetchPortfolioData(false);
      
      const interval = setInterval(() => {
        fetchPortfolioData(true);
      }, 5000);
      
      return () => clearInterval(interval);
    }
  }, [user?.id, fetchPortfolioData]);

  // Date Range Filtering Logic
  const filterByDate = useCallback((dateStr: string) => {
    if (selectedDateFilter === "ALL") return true;
    const date = new Date(dateStr);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (selectedDateFilter) {
      case "TODAY":
        return date >= startOfToday;
      case "LAST_7": {
        const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        return date >= sevenDaysAgo;
      }
      case "LAST_30": {
        const thirtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
        return date >= thirtyDaysAgo;
      }
      case "THIS_MONTH": {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return date >= startOfMonth;
      }
      case "LAST_MONTH": {
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        return date >= startOfLastMonth && date <= endOfLastMonth;
      }
      case "THIS_YEAR": {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        return date >= startOfYear;
      }
      case "CUSTOM": {
        let match = true;
        if (startDate) {
          match = match && date >= new Date(startDate);
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          match = match && date <= end;
        }
        return match;
      }
      default:
        return true;
    }
  }, [selectedDateFilter, startDate, endDate]);

  // Filtered Datasets
  const filteredActivePositions = useMemo(() => {
    return activePositions.filter(p => filterByDate(p.openedAt));
  }, [activePositions, filterByDate]);

  const filteredClosedTrades = useMemo(() => {
    return closedTrades.filter(t => filterByDate(t.closedAt));
  }, [closedTrades, filterByDate]);

  // Section 1 Math: Wallet Balance, Profit, Loss, PnL
  const usedMargin = useMemo(() => {
    let total = 0;
    activePositions.forEach((pos) => {
      total += (pos.entryPrice * pos.quantity) / (pos.leverage || 1);
    });
    return total;
  }, [activePositions]);

  const availableBalance = useMemo(() => {
    return wallet.balance - usedMargin;
  }, [wallet.balance, usedMargin]);

  const startingCapital = useMemo(() => {
    return wallet.totalDeposited > 0 ? wallet.totalDeposited : 10000.0;
  }, [wallet.totalDeposited]);

  const totalProfit = useMemo(() => {
    return filteredClosedTrades.reduce((sum, t) => {
      const net = t.netPnl ?? t.pnl;
      return net > 0 ? sum + net : sum;
    }, 0);
  }, [filteredClosedTrades]);

  const totalLoss = useMemo(() => {
    return filteredClosedTrades.reduce((sum, t) => {
      const net = t.netPnl ?? t.pnl;
      return net < 0 ? sum + Math.abs(net) : sum;
    }, 0);
  }, [filteredClosedTrades]);

  const unrealizedPnL = useMemo(() => {
    let sum = 0;
    filteredActivePositions.forEach((pos) => {
      const livePrice = tickerData[pos.symbol]?.price || pos.currentPrice || pos.entryPrice;
      const isLong = pos.direction === "LONG";
      const pnl = isLong 
        ? (livePrice - pos.entryPrice) * pos.quantity
        : (pos.entryPrice - livePrice) * pos.quantity;
      sum += pnl;
    });
    return sum;
  }, [filteredActivePositions, tickerData]);

  const currentEquity = useMemo(() => {
    return wallet.balance + unrealizedPnL;
  }, [wallet.balance, unrealizedPnL]);

  const realizedPnL = useMemo(() => {
    return filteredClosedTrades.reduce((sum, t) => sum + (t.netPnl ?? t.pnl), 0);
  }, [filteredClosedTrades]);

  const totalFeesPaid = useMemo(() => {
    return filteredClosedTrades.reduce((sum, t) => sum + (t.totalFees ?? 0), 0);
  }, [filteredClosedTrades]);

  // Section 2: Equity Curve Generation
  const equityCurveData = useMemo(() => {
    const sortedTrades = [...filteredClosedTrades].sort(
      (a, b) => new Date(a.closedAt).getTime() - new Date(b.closedAt).getTime()
    );

    if (sortedTrades.length === 0) return [];

    let currentVal = startingCapital;
    const timeMap = new Map<number, number>();

    const startTimestamp = Math.floor(new Date(sortedTrades[0].openedAt).getTime() / 1000);
    const firstCloseTimestamp = Math.floor(new Date(sortedTrades[0].closedAt).getTime() / 1000);
    
    // Guarantee start point is before first close
    const safeStartTimestamp = startTimestamp < firstCloseTimestamp ? startTimestamp : firstCloseTimestamp - 1;
    timeMap.set(safeStartTimestamp, startingCapital);

    sortedTrades.forEach((trade) => {
      currentVal += trade.netPnl ?? trade.pnl;
      const time = Math.floor(new Date(trade.closedAt).getTime() / 1000);
      
      // If multiple trades close on the exact same second, this overwrites the value with the aggregated PnL
      timeMap.set(time, currentVal);
    });

    const curve = Array.from(timeMap.entries())
      .map(([time, value]) => ({ time: time as UTCTimestamp, value }))
      .sort((a, b) => a.time - b.time);

    return curve;
  }, [filteredClosedTrades, startingCapital]);

  const hasSufficientCurveData = useMemo(() => {
    return filteredClosedTrades.length >= 2;
  }, [filteredClosedTrades]);

  // Section 5: Drawdown Analytics Math
  const drawdownStats = useMemo(() => {
    let peak = startingCapital;
    let maxDrawdownPercent = 0;
    let currentVal = startingCapital;

    const sortedTrades = [...filteredClosedTrades].sort(
      (a, b) => new Date(a.closedAt).getTime() - new Date(b.closedAt).getTime()
    );

    sortedTrades.forEach((t) => {
      currentVal += t.netPnl ?? t.pnl;
      if (currentVal > peak) {
        peak = currentVal;
      }
      const ddPercent = ((peak - currentVal) / peak) * 100;
      if (ddPercent > maxDrawdownPercent) {
        maxDrawdownPercent = ddPercent;
      }
    });

    const currentEquityVal = currentEquity;
    const currentPeak = Math.max(peak, currentEquityVal);
    const currentDrawdownPercent = currentPeak > 0 ? ((currentPeak - currentEquityVal) / currentPeak) * 100 : 0;

    let recoveryPercent = 100;
    if (maxDrawdownPercent > 0) {
      const maxTrough = peak * (1 - maxDrawdownPercent / 100);
      const totalDrawdownAmount = peak - maxTrough;
      if (totalDrawdownAmount > 0) {
        const recoveredAmount = currentEquityVal - maxTrough;
        recoveryPercent = Math.max(0, Math.min(100, (recoveredAmount / totalDrawdownAmount) * 100));
      } else {
        recoveryPercent = 0;
      }
    }

    return {
      maxDrawdown: -maxDrawdownPercent,
      currentDrawdown: -currentDrawdownPercent,
      recovery: recoveryPercent
    };
  }, [filteredClosedTrades, startingCapital, currentEquity]);

  // Strategy Leaderboard Calculations
  const strategyStats = useMemo(() => {
    const statsMap: Record<string, {
      strategy: string;
      trades: number;
      wins: number;
      losses: number;
      totalGains: number;
      totalLosses: number;
      netProfit: number;
      totalRoi: number;
    }> = {};

    filteredClosedTrades.forEach((t) => {
      const name = t.strategyName || "Central Engine";
      if (!statsMap[name]) {
        statsMap[name] = {
          strategy: name,
          trades: 0,
          wins: 0,
          losses: 0,
          totalGains: 0,
          totalLosses: 0,
          netProfit: 0,
          totalRoi: 0,
        };
      }
      const s = statsMap[name];
      s.trades += 1;
      const tradeNetPnl = t.netPnl ?? t.pnl; // USE netPnl
      if (tradeNetPnl > 0) {
        s.wins += 1;
        s.totalGains += tradeNetPnl;
      } else {
        s.losses += 1;
        s.totalLosses += Math.abs(tradeNetPnl);
      }
      s.netProfit += tradeNetPnl;
      s.totalRoi += t.roi;
    });

    return Object.values(statsMap)
      .map((s) => {
        let pf = "N/A";
        if (s.totalLosses > 0) {
          pf = (s.totalGains / s.totalLosses).toFixed(2);
        } else if (s.totalGains > 0) {
          pf = "∞";
        }
        return {
          strategy: s.strategy,
          trades: s.trades,
          winRate: s.trades > 0 ? (s.wins / s.trades) * 100 : 0,
          profitFactor: pf,
          netProfit: s.netProfit,
          avgRoi: s.trades > 0 ? s.totalRoi / s.trades : 0,
        };
      })
      .sort((a, b) => b.netProfit - a.netProfit);
  }, [filteredClosedTrades]);

  // Highlight Cards Calculations
  const performanceHighlights = useMemo(() => {
    const strategies = strategyStats.map(s => s.strategy);
    const uniqueStrategyCount = strategies.length;

    let bestStrat = "N/A";
    let bestStratPnl = -Infinity;
    let worstStrat = "N/A";
    let worstStratPnl = Infinity;

    strategyStats.forEach((s) => {
      if (s.netProfit > bestStratPnl) {
        bestStratPnl = s.netProfit;
        bestStrat = s.strategy;
      }
      if (s.netProfit < worstStratPnl) {
        worstStratPnl = s.netProfit;
        worstStrat = s.strategy;
      }
    });

    const assetPnlMap: Record<string, number> = {};
    filteredClosedTrades.forEach((t) => {
      assetPnlMap[t.symbol] = (assetPnlMap[t.symbol] || 0) + (t.netPnl ?? t.pnl);
    });

    const uniqueAssetCount = Object.keys(assetPnlMap).length;

    let bestAsset = "N/A";
    let bestAssetPnl = -Infinity;
    let worstAsset = "N/A";
    let worstAssetPnl = Infinity;

    Object.entries(assetPnlMap).forEach(([symbol, pnl]) => {
      if (pnl > bestAssetPnl) {
        bestAssetPnl = pnl;
        bestAsset = symbol;
      }
      if (pnl < worstAssetPnl) {
        worstAssetPnl = pnl;
        worstAsset = symbol;
      }
    });

    return {
      uniqueStrategyCount,
      uniqueAssetCount,
      bestStrategy: bestStratPnl === -Infinity ? "N/A" : bestStrat,
      worstStrategy: worstStratPnl === Infinity ? "N/A" : worstStrat,
      bestAsset: bestAssetPnl === -Infinity ? "N/A" : bestAsset,
      worstAsset: worstAssetPnl === Infinity ? "N/A" : worstAsset,
    };
  }, [strategyStats, filteredClosedTrades]);

  // Lightweight Charts Render
  useEffect(() => {
    if (!chartContainerRef.current || !hasSufficientCurveData) return;

    const isDark = resolvedTheme === "dark";
    const colors = {
      text: isDark ? "#a1a1aa" : "#64748b",
      grid: isDark ? "rgba(24, 24, 27, 0.1)" : "rgba(241, 245, 249, 0.1)",
      line: "#00D4FF",
      areaTop: "rgba(0, 212, 255, 0.2)",
      areaBottom: "rgba(0, 212, 255, 0.0)",
      crosshair: isDark ? "rgba(161, 161, 170, 0.4)" : "rgba(100, 116, 139, 0.4)",
    };

    let tickMarkFormatter: ((time: number) => string) | undefined = undefined;
    if (selectedDateFilter === "LAST_7" || selectedDateFilter === "TODAY") {
      tickMarkFormatter = (time: number) => {
        const d = new Date(time * 1000);
        return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      };
    } else if (selectedDateFilter === "LAST_30" || selectedDateFilter === "THIS_MONTH" || selectedDateFilter === "LAST_MONTH") {
      tickMarkFormatter = (time: number) => {
        const d = new Date(time * 1000);
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      };
    } else {
      tickMarkFormatter = (time: number) => {
        const d = new Date(time * 1000);
        return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
      };
    }

    let chart = chartInstanceRef.current;
    let areaSeries = seriesInstanceRef.current;

    if (!chart) {
      chart = createChart(chartContainerRef.current, {
        layout: {
          background: { color: "transparent" },
          textColor: colors.text,
          fontFamily: "var(--font-sans), sans-serif",
          fontSize: 11,
        },
        grid: {
          vertLines: { color: colors.grid },
          horzLines: { color: colors.grid },
        },
        rightPriceScale: {
          borderVisible: false,
          alignLabels: true,
        },
        timeScale: {
          borderVisible: false,
          timeVisible: true,
          fixLeftEdge: true,
          tickMarkFormatter: tickMarkFormatter,
        },
        crosshair: {
          vertLine: { color: colors.crosshair, labelBackgroundColor: "#18181b" },
          horzLine: { color: colors.crosshair, labelBackgroundColor: "#18181b" },
        },
        autoSize: true,
      });

      areaSeries = chart.addSeries(AreaSeries, {
        lineColor: colors.line,
        topColor: colors.areaTop,
        bottomColor: colors.areaBottom,
        lineWidth: 2,
        lineType: LineType.Curved,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
        crosshairMarkerBorderColor: "#fff",
        crosshairMarkerBackgroundColor: colors.line,
      });

      chartInstanceRef.current = chart;
      seriesInstanceRef.current = areaSeries;

      setTimeout(() => {
        if (chartInstanceRef.current) {
          chartInstanceRef.current.timeScale().fitContent();
        }
      }, 100);
    } else {
      chart.applyOptions({
        layout: {
          textColor: colors.text,
        },
        grid: {
          vertLines: { color: colors.grid },
          horzLines: { color: colors.grid },
        },
        timeScale: {
          tickMarkFormatter: tickMarkFormatter,
        },
        crosshair: {
          vertLine: { color: colors.crosshair },
          horzLine: { color: colors.crosshair },
        }
      });

      areaSeries.applyOptions({
        lineColor: colors.line,
        topColor: colors.areaTop,
        bottomColor: colors.areaBottom,
        crosshairMarkerBackgroundColor: colors.line,
      });
    }

    areaSeries.setData(equityCurveData);

  }, [equityCurveData, hasSufficientCurveData, resolvedTheme, selectedDateFilter]);

  // Handle unmount cleanup
  useEffect(() => {
    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.applyOptions({ autoSize: false });
        chartInstanceRef.current.remove();
        chartInstanceRef.current = null;
        seriesInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <>
      <TradingLoader loading={authLoading || loading} />
      <div className="flex h-screen w-screen bg-background text-foreground overflow-hidden font-sans select-none transition-colors duration-300">
        <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-background/95">
        <Navbar />

        <main className="flex-1 px-8 py-6 pb-16 space-y-6 min-h-0">
          
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
            <div>
              <h1 className="text-xl font-black tracking-tight text-foreground uppercase flex items-center gap-2">
                <Briefcase className="text-primary" size={22} />
                Portfolio Intelligence & Analytics
              </h1>
              <p className="text-xs text-muted-foreground">
                Institutional-grade performance analysis, equity tracking, and strategy breakdowns.
              </p>
            </div>
            
            <button 
              onClick={() => fetchPortfolioData()} 
              className="px-4 py-2 bg-secondary/80 hover:bg-secondary text-foreground text-xs font-black uppercase tracking-wider rounded-xl border border-border transition duration-200"
            >
              Refresh Data
            </button>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-xl p-4 flex items-center gap-3">
              <p className="text-xs font-semibold">{error}</p>
            </div>
          )}

          {/* Date Presets Filter */}
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
            <div className="flex flex-wrap items-end gap-3 w-full">
              <FilterDropdown
                label="Date Range"
                value={selectedDateFilter}
                options={[
                  { label: "All Time", value: "ALL" },
                  { label: "Today", value: "TODAY" },
                  { label: "Last 7 Days", value: "LAST_7" },
                  { label: "Last 30 Days", value: "LAST_30" },
                  { label: "This Month", value: "THIS_MONTH" },
                  { label: "Last Month", value: "LAST_MONTH" },
                  { label: "This Year", value: "THIS_YEAR" },
                  { label: "Custom Range", value: "CUSTOM" }
                ]}
                onChange={setSelectedDateFilter}
              />

              {selectedDateFilter === "CUSTOM" && (
                <div className="flex flex-wrap items-center gap-3 animate-fade-in">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Start Date</span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="px-3 py-2 bg-card border border-border text-foreground text-xs font-semibold rounded-[10px] focus:outline-none focus:border-primary h-9 cursor-pointer"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">End Date</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="px-3 py-2 bg-card border border-border text-foreground text-xs font-semibold rounded-[10px] focus:outline-none focus:border-primary h-9 cursor-pointer"
                    />
                  </div>
                </div>
              )}

              <div className="text-[10px] font-black uppercase text-muted-foreground self-end h-9 flex items-center ml-auto">
                Tracking {filteredClosedTrades.length} Closed & {filteredActivePositions.length} Open Positions
              </div>
            </div>
          </div>

          {/* Section 1: Account Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
            
            {/* Total Wallet Balance */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block">Total Wallet Balance</span>
              <div>
                <span className="text-2xl font-black text-foreground">${availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                <span className="text-[10px] text-muted-foreground block mt-1">Available Trading Balance</span>
              </div>
            </div>

            {/* Total Profit */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block">Total Profit</span>
              <div>
                <span className="text-2xl font-black text-emerald-500">+${totalProfit.toFixed(2)}</span>
                <span className="text-[10px] text-muted-foreground block mt-1">Sum of Winning Closed Trades</span>
              </div>
            </div>

            {/* Total Loss */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block">Total Loss</span>
              <div>
                <span className="text-2xl font-black text-destructive">-${totalLoss.toFixed(2)}</span>
                <span className="text-[10px] text-muted-foreground block mt-1">Sum of Losing Closed Trades</span>
              </div>
            </div>

            {/* Net Profitability */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block">Net Profitability</span>
              <div>
                <span className={`text-2xl font-black ${realizedPnL >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                  {realizedPnL >= 0 ? "+" : ""}${realizedPnL.toFixed(2)}
                </span>
                <span className="text-[10px] text-muted-foreground block mt-1">Closed Trades Cumulative</span>
              </div>
            </div>

            {/* Total Fees Paid */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block">Total Fees Paid</span>
              <div>
                <span className="text-2xl font-black text-amber-500">${totalFeesPaid.toFixed(2)}</span>
                <span className="text-[10px] text-muted-foreground block mt-1">Exchange Entry/Exit Fees</span>
              </div>
            </div>

            {/* Unrealized PnL */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block">Unrealized PnL</span>
              <div>
                <span className={`text-2xl font-black ${unrealizedPnL >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                  {unrealizedPnL >= 0 ? "+" : ""}${unrealizedPnL.toFixed(2)}
                </span>
                <span className="text-[10px] text-muted-foreground block mt-1">Floating Positions PnL</span>
              </div>
            </div>
          </div>

          {/* Middle Section: Equity Curve & Drawdown */}
          <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
            
            {/* Portfolio Equity Curve Chart (Large ~ 70%) */}
            <div className="lg:col-span-7 bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col h-[400px]">
              <div className="flex justify-between items-center border-b border-border pb-3 mb-4 shrink-0">
                <h3 className="text-xs font-black uppercase tracking-wider text-foreground">Portfolio Equity Curve</h3>
                <span className="text-[10px] text-muted-foreground uppercase">Historical Capital Growth</span>
              </div>
              <div className="flex-1 w-full min-h-0 relative">
                {hasSufficientCurveData ? (
                  <div className="w-full h-full" ref={chartContainerRef} />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs font-semibold bg-secondary/10 rounded-lg uppercase tracking-wider border border-dashed border-border">
                    Insufficient historical data
                  </div>
                )}
              </div>
            </div>

            {/* Drawdown Metrics & Highlights (~30%) */}
            <div className="lg:col-span-3 space-y-6">
              
              {/* Drawdown Card */}
              <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
                <div className="border-b border-border pb-2">
                  <h3 className="text-xs font-black uppercase tracking-wider text-foreground">Drawdown Analytics</h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <span className="text-[9px] font-black text-muted-foreground uppercase block">Current Drawdown</span>
                    <span className="text-xl font-black text-amber-500">{drawdownStats.currentDrawdown.toFixed(2)}%</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-muted-foreground uppercase block">Max Drawdown</span>
                    <span className="text-xl font-black text-destructive">{drawdownStats.maxDrawdown.toFixed(2)}%</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-muted-foreground uppercase block">Recovery Percentage</span>
                    <span className="text-xl font-black text-emerald-500">{drawdownStats.recovery.toFixed(0)}%</span>
                  </div>
                </div>
              </div>

              {/* Performance Highlights Card */}
              <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
                <div className="border-b border-border pb-2">
                  <h3 className="text-xs font-black uppercase tracking-wider text-foreground">Performance Highlights</h3>
                </div>

                <div className="space-y-3.5">
                  <div>
                    <span className="text-[9px] font-black text-muted-foreground uppercase block">Best Strategy</span>
                    {performanceHighlights.uniqueStrategyCount <= 1 ? (
                      <span className="text-xs font-bold text-muted-foreground block mt-0.5">
                        Waiting for additional strategy data
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-emerald-500 truncate block mt-0.5" title={performanceHighlights.bestStrategy}>
                        {performanceHighlights.bestStrategy}
                      </span>
                    )}
                  </div>

                  {performanceHighlights.uniqueStrategyCount > 1 && (
                    <div>
                      <span className="text-[9px] font-black text-muted-foreground uppercase block">Worst Strategy</span>
                      <span className="text-xs font-bold text-destructive truncate block mt-0.5" title={performanceHighlights.worstStrategy}>
                        {performanceHighlights.worstStrategy}
                      </span>
                    </div>
                  )}

                  {performanceHighlights.uniqueAssetCount > 1 && (
                    <>
                      <div>
                        <span className="text-[9px] font-black text-muted-foreground uppercase block">Best Asset</span>
                        <span className="text-xs font-bold text-emerald-500 block mt-0.5">
                          {performanceHighlights.bestAsset}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-black text-muted-foreground uppercase block">Worst Asset</span>
                        <span className="text-xs font-bold text-destructive block mt-0.5">
                          {performanceHighlights.worstAsset}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* Bottom Section: Strategy Leaderboard */}
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden animate-fade-in">
            <div className="px-5 py-4 border-b border-border bg-secondary/10">
              <h3 className="text-xs font-black uppercase tracking-wider text-foreground">Strategy Leaderboard</h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border bg-secondary/20 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                    <th className="px-5 py-3">Strategy</th>
                    <th className="px-5 py-3 text-right">Trades</th>
                    <th className="px-5 py-3 text-right">Win Rate</th>
                    <th className="px-5 py-3 text-right">Profit Factor</th>
                    <th className="px-5 py-3 text-right">Net Profit</th>
                    <th className="px-5 py-3 text-right">ROI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-muted-foreground font-semibold">
                        Querying strategy results...
                      </td>
                    </tr>
                  ) : strategyStats.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-muted-foreground font-medium">
                        No trade strategy statistics found.
                      </td>
                    </tr>
                  ) : (
                    strategyStats.map((item) => (
                      <tr key={item.strategy} className="hover:bg-secondary/20 transition-colors">
                        <td className="px-5 py-3 font-extrabold text-foreground">{item.strategy}</td>
                        <td className="px-5 py-3 text-right font-medium">{item.trades}</td>
                        <td className="px-5 py-3 text-right font-semibold">{item.winRate.toFixed(1)}%</td>
                        <td className="px-5 py-3 text-right font-semibold">{item.profitFactor}</td>
                        <td className={`px-5 py-3 text-right font-extrabold ${item.netProfit >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                          {item.netProfit >= 0 ? "+" : ""}${item.netProfit.toFixed(2)}
                        </td>
                        <td className={`px-5 py-3 text-right font-bold ${item.avgRoi >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                          {item.avgRoi >= 0 ? "+" : ""}{item.avgRoi.toFixed(2)}%
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </main>
      </div>
    </div>
    </>
  );
}
