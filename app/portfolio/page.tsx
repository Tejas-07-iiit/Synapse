"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { useMarketStore } from "@/src/stores/marketStore";
import { useWalletStore } from "@/src/stores/walletStore";
import Sidebar from "@/components/sidebar/Sidebar";
import Navbar from "@/components/navbar/Navbar";
import { 
  Briefcase, 
  Activity, 
  ShieldAlert, 
  ArrowUpRight, 
  ArrowDownRight,
  PieChart,
  History,
  AlertTriangle,
  Info
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
}

interface PositionDisplay {
  id: string;
  symbol: string;
  direction: "LONG" | "SHORT";
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  marginUsed: number;
  pnl: number;
  roi: number;
  leverage: number;
  liquidationPrice: number;
  status: string;
  openedAt: Date;
}

export default function PortfolioPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuthStore();
  const tickerData = useMarketStore((state) => state.tickerData);

  const [activePositions, setActivePositions] = useState<DbPosition[]>([]);
  const [closedTrades, setClosedTrades] = useState<DbTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, authLoading, router]);

  const fetchPortfolioData = useCallback(async () => {
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

      await useWalletStore.getState().fetchWallet(user.id);
      
      setError(null);
    } catch (err) {
      console.error("[Portfolio] Error fetching data:", err);
      setError("Failed to fetch portfolio data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      fetchPortfolioData();
    }
  }, [user?.id, fetchPortfolioData]);

  const wallet = useWalletStore((state) => state);

  // Calculate stats in real-time by combining positions with socket prices
  const portfolioStats = useMemo(() => {
    let unrealizedPnl = 0;
    let usedMargin = 0;
    const positionsList: PositionDisplay[] = [];

    activePositions.forEach((pos) => {
      const livePrice = tickerData[pos.symbol]?.price || pos.currentPrice || pos.entryPrice;
      const leverage = pos.leverage || 1;
      const isLong = pos.direction === "LONG";
      
      const currentPrice = livePrice;
      const quantity = pos.quantity;
      const entryPrice = pos.entryPrice;

      // margin used = (entryPrice * size) / leverage
      const posMargin = (entryPrice * quantity) / leverage;
      
      const pnl = isLong 
        ? (currentPrice - entryPrice) * quantity
        : (entryPrice - currentPrice) * quantity;
        
      const roi = isLong
        ? ((currentPrice - entryPrice) / entryPrice) * 100 * leverage
        : ((entryPrice - currentPrice) / entryPrice) * 100 * leverage;

      // Liquidation price = entry * (1 - 1/leverage + margin_ratio_buffer)
      const maintenanceMarginBuffer = 0.005; 
      const liqPrice = isLong
        ? entryPrice * (1 - (1 / leverage) + maintenanceMarginBuffer)
        : entryPrice * (1 + (1 / leverage) - maintenanceMarginBuffer);

      unrealizedPnl += pnl;
      usedMargin += posMargin;

      positionsList.push({
        id: pos.id,
        symbol: pos.symbol,
        direction: pos.direction as "LONG" | "SHORT",
        entryPrice,
        currentPrice,
        quantity,
        marginUsed: posMargin,
        pnl,
        roi,
        leverage,
        liquidationPrice: Math.max(0, liqPrice),
        status: pos.status,
        openedAt: new Date(pos.openedAt)
      });
    });

    const realizedPnl = wallet.realizedPnl;
    const availableBalance = wallet.balance - usedMargin;
    const totalValue = wallet.balance + unrealizedPnl;
    const totalDeposited = wallet.totalDeposited || 10000.0;
    const totalRoi = ((totalValue - totalDeposited) / totalDeposited) * 100;

    return {
      totalValue,
      totalDeposited,
      availableBalance,
      usedMargin,
      unrealizedPnl,
      realizedPnl,
      totalRoi,
      positionsList,
      totalTradesCount: activePositions.length + closedTrades.length
    };
  }, [activePositions, closedTrades, tickerData, wallet]);

  // Asset allocation percentages
  const allocations = useMemo(() => {
    const list: { symbol: string; value: number; percent: number; color: string }[] = [];
    let totalMargin = 0;

    portfolioStats.positionsList.forEach((pos) => {
      totalMargin += pos.marginUsed;
    });

    if (totalMargin > 0) {
      const grouped = portfolioStats.positionsList.reduce((acc: Record<string, number>, pos) => {
        acc[pos.symbol] = (acc[pos.symbol] || 0) + pos.marginUsed;
        return acc;
      }, {});

      const colors = ["bg-primary", "bg-purple-500", "bg-amber-500", "bg-indigo-500"];
      let colorIndex = 0;

      Object.entries(grouped).forEach(([sym, val]) => {
        list.push({
          symbol: sym,
          value: val,
          percent: (val / totalMargin) * 100,
          color: colors[colorIndex % colors.length]
        });
        colorIndex++;
      });
    }

    return list;
  }, [portfolioStats.positionsList]);

  // Risk parameters metrics
  const riskMetrics = useMemo(() => {
    const marginRatio = portfolioStats.totalValue > 0 
      ? (portfolioStats.usedMargin / portfolioStats.totalValue) * 100 
      : 0;

    let exposureLevel: "LOW" | "MODERATE" | "HIGH" = "LOW";
    let riskColor = "text-emerald-500 border-emerald-500/20 bg-emerald-500/10";
    if (marginRatio > 40) {
      exposureLevel = "HIGH";
      riskColor = "text-destructive border-destructive/20 bg-destructive/10";
    } else if (marginRatio > 15) {
      exposureLevel = "MODERATE";
      riskColor = "text-amber-500 border-amber-500/20 bg-amber-500/10";
    }

    // Portfolio Leverage
    let totalExposure = 0;
    portfolioStats.positionsList.forEach((pos) => {
      totalExposure += pos.entryPrice * pos.quantity * pos.leverage;
    });
    const effectiveLeverage = portfolioStats.totalValue > 0
      ? totalExposure / portfolioStats.totalValue
      : 1;

    const maxDrawdown = portfolioStats.realizedPnl >= 0
      ? 0
      : (Math.abs(portfolioStats.realizedPnl) / portfolioStats.totalDeposited) * 100;

    return {
      marginRatio,
      exposureLevel,
      riskColor,
      effectiveLeverage,
      maxDrawdown
    };
  }, [portfolioStats]);

  // Recent activity log generator
  const recentActivities = useMemo(() => {
    const activities: { id: string; type: string; message: string; timestamp: Date; color: string }[] = [];

    activePositions.forEach((pos) => {
      activities.push({
        id: `act-open-${pos.id}`,
        type: "OPEN",
        message: `Opened paper position: ${pos.direction} ${pos.symbol} (${pos.leverage}x Leverage) at $${pos.entryPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
        timestamp: new Date(pos.openedAt),
        color: "border-primary text-primary"
      });
    });

    closedTrades.slice(0, 10).forEach((tr) => {
      const isProfit = tr.pnl >= 0;
      activities.push({
        id: `act-close-${tr.id}`,
        type: "CLOSE",
        message: `Closed position: ${tr.direction} ${tr.symbol} at $${tr.exitPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}. Out: ${tr.status}. PnL: ${isProfit ? "+" : ""}$${tr.pnl.toFixed(2)} (${tr.roi.toFixed(2)}%)`,
        timestamp: new Date(tr.closedAt),
        color: isProfit ? "border-emerald-500 text-emerald-500" : "border-destructive text-destructive"
      });
    });

    return activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [activePositions, closedTrades]);

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

        {/* Portfolio Workspace Body */}
        <main className="flex-1 px-8 py-6 pb-16 space-y-6 min-h-0">
          
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-4">
            <div>
              <h1 className="text-xl font-black tracking-tight text-foreground uppercase flex items-center gap-2">
                <Briefcase className="text-primary" size={22} />
                Portfolio Analytics & Assets
              </h1>
              <p className="text-xs text-muted-foreground">
                Overview of capital allocations, active margins, and paper trading accounts.
              </p>
            </div>
            
            <button 
              onClick={fetchPortfolioData} 
              className="px-4 py-2 bg-secondary/80 hover:bg-secondary text-foreground text-xs font-black uppercase tracking-wider rounded-xl border border-border transition duration-200"
            >
              Refresh Assets
            </button>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-xl p-4 flex items-center gap-3">
              <AlertTriangle size={20} />
              <p className="text-xs font-semibold">{error}</p>
            </div>
          )}

          {/* Section 1: Portfolio Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Portfolio Total Net Worth */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-3">
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block">Net Asset Value</span>
              <div>
                <span className="text-2xl font-black">${portfolioStats.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                <span className="text-xs text-muted-foreground block">Capital Budget Base: ${portfolioStats.totalDeposited.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="w-full bg-secondary h-1 rounded-full overflow-hidden">
                <div 
                  className="bg-primary h-full rounded-full" 
                  style={{ width: `${Math.min(100, (portfolioStats.totalValue / portfolioStats.totalDeposited) * 100)}%` }}
                />
              </div>
            </div>

            {/* Available Balance */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-3">
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block">Available Balance</span>
              <div>
                <span className="text-2xl font-black">${portfolioStats.availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                <span className="text-xs text-muted-foreground block">Allocated Margin: ${portfolioStats.usedMargin.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Unrealized & Realized PnL */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-3">
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block">Floating vs Realized PNL</span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className={`text-lg font-black ${portfolioStats.unrealizedPnl >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                    {portfolioStats.unrealizedPnl >= 0 ? "+" : ""}${portfolioStats.unrealizedPnl.toFixed(2)}
                  </span>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Floating</p>
                </div>
                <div>
                  <span className={`text-lg font-black ${portfolioStats.realizedPnl >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                    {portfolioStats.realizedPnl >= 0 ? "+" : ""}${portfolioStats.realizedPnl.toFixed(2)}
                  </span>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Realized</p>
                </div>
              </div>
            </div>

            {/* Total Account ROI */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-3">
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block">Aggregate Account ROI</span>
              <div className="flex justify-between items-baseline">
                <div>
                  <span className={`text-2xl font-black ${portfolioStats.totalRoi >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                    {portfolioStats.totalRoi >= 0 ? "+" : ""}{portfolioStats.totalRoi.toFixed(2)}%
                  </span>
                  <span className="text-xs text-muted-foreground block">Total Transactions: {portfolioStats.totalTradesCount}</span>
                </div>
                <div className={`px-2 py-0.5 rounded text-[10px] font-black border ${
                  portfolioStats.totalRoi >= 0 
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" 
                    : "bg-destructive/10 border-destructive/20 text-destructive"
                }`}>
                  {portfolioStats.totalRoi >= 0 ? "PROFIT" : "DRAWDOWN"}
                </div>
              </div>
            </div>

          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            
            {/* Section 2: Active Positions Table */}
            <div className="xl:col-span-2 space-y-6">
              <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-border/80 flex items-center justify-between bg-secondary/15">
                  <h2 className="text-xs font-black uppercase tracking-wider text-foreground">Active Margined Positions</h2>
                  <span className="text-[10px] font-black text-primary uppercase bg-primary/10 border border-primary/20 px-2 py-0.5 rounded">
                    {portfolioStats.positionsList.length} Position{portfolioStats.positionsList.length !== 1 ? "s" : ""} Open
                  </span>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border/80 bg-secondary/20 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                        <th className="px-4 py-3">Market</th>
                        <th className="px-4 py-3">Side</th>
                        <th className="px-4 py-3 text-right">Leverage</th>
                        <th className="px-4 py-3 text-right">Entry Price</th>
                        <th className="px-4 py-3 text-right">Mark Price</th>
                        <th className="px-4 py-3 text-right">Margin Size</th>
                        <th className="px-4 py-3 text-right">Liq. Price</th>
                        <th className="px-4 py-3 text-right">PnL (ROI)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {loading ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground font-semibold">
                            <Activity className="animate-spin text-primary mx-auto mb-2" size={20} />
                            Fetching positions snapshot...
                          </td>
                        </tr>
                      ) : portfolioStats.positionsList.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground font-medium">
                            No active positions. Trigger strategies or place paper trades to open a position.
                          </td>
                        </tr>
                      ) : (
                        portfolioStats.positionsList.map((pos) => {
                          const isProfit = pos.pnl >= 0;
                          return (
                            <tr key={pos.id} className="hover:bg-secondary/20 transition-colors">
                              <td className="px-4 py-3.5 font-extrabold text-foreground">{pos.symbol}</td>
                              <td className="px-4 py-3.5">
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase border ${
                                  pos.direction === "LONG" 
                                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
                                    : "bg-destructive/10 text-destructive border-destructive/20"
                                }`}>
                                  {pos.direction}
                                </span>
                              </td>
                              <td className="px-4 py-3.5 text-right font-bold text-muted-foreground">{pos.leverage}x</td>
                              <td className="px-4 py-3.5 text-right font-mono">${pos.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                              <td className="px-4 py-3.5 text-right font-mono font-semibold">${pos.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                              <td className="px-4 py-3.5 text-right font-mono font-semibold text-muted-foreground">${pos.marginUsed.toFixed(2)}</td>
                              <td className="px-4 py-3.5 text-right font-mono font-bold text-amber-500/90">${pos.liquidationPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                              <td className={`px-4 py-3.5 text-right font-extrabold ${isProfit ? "text-emerald-500" : "text-destructive"}`}>
                                <div className="flex flex-col items-end">
                                  <span className="flex items-center gap-0.5">
                                    {isProfit ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                                    {isProfit ? "+" : ""}${pos.pnl.toFixed(2)}
                                  </span>
                                  <span className="text-[10px] font-bold">
                                    {isProfit ? "+" : ""}{pos.roi.toFixed(2)}%
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Section 5: Risk Summary parameters */}
              <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-primary border-b border-border/40 pb-2">
                  <ShieldAlert size={16} />
                  <h3 className="font-black text-xs uppercase tracking-wider text-card-foreground">System Risk Profile Summary</h3>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  
                  {/* Risk Level */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-muted-foreground uppercase block">Exposure Level</span>
                    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-black border ${riskMetrics.riskColor}`}>
                      {riskMetrics.exposureLevel}
                    </span>
                  </div>

                  {/* Portfolio Leverage */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-muted-foreground uppercase block">Effective Leverage</span>
                    <span className="text-sm font-black text-foreground">{riskMetrics.effectiveLeverage.toFixed(2)}x</span>
                  </div>

                  {/* Margin Ratio */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-muted-foreground uppercase block">Margin Ratio</span>
                    <span className="text-sm font-black text-foreground">{riskMetrics.marginRatio.toFixed(1)}%</span>
                  </div>

                  {/* Drawdown */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-muted-foreground uppercase block">Portfolio Drawdown</span>
                    <span className={`text-sm font-black ${riskMetrics.maxDrawdown > 0 ? "text-destructive" : "text-emerald-500"}`}>
                      {riskMetrics.maxDrawdown.toFixed(2)}%
                    </span>
                  </div>

                </div>

                <div className="flex gap-2.5 items-start text-[11px] text-muted-foreground leading-relaxed bg-secondary/15 border border-border/20 px-3 py-2.5 rounded-lg">
                  <Info size={14} className="text-primary mt-0.5 shrink-0" />
                  <p>
                    <b>Maintenance Threshold Warning:</b> Synapse enforces a strict paper liquidation margin buffer of <b>0.5%</b>. Real-time floating margin updates above 40% will flag portfolio state as <b>HIGH EXPOSURE</b>. Adjust strategy allocation metrics or decrease leverage.
                  </p>
                </div>
              </div>

            </div>

            {/* Column Right: Allocations & Activities */}
            <div className="space-y-6">
              
              {/* Section 3: Asset Allocation */}
              <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col space-y-4">
                <div className="flex items-center gap-2 text-primary border-b border-border/40 pb-2">
                  <PieChart size={16} />
                  <h3 className="font-black text-xs uppercase tracking-wider text-card-foreground">Margin Asset Allocation</h3>
                </div>

                {allocations.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">
                    No allocated active assets. All capital available as USD cash.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {/* Visual Segmented Progress Bar */}
                    <div className="w-full bg-secondary h-4 rounded-lg overflow-hidden flex">
                      {allocations.map((alloc) => (
                        <div 
                          key={alloc.symbol} 
                          className={`${alloc.color} h-full transition-all`} 
                          style={{ width: `${alloc.percent}%` }}
                          title={`${alloc.symbol}: ${alloc.percent.toFixed(1)}%`}
                        />
                      ))}
                    </div>

                    {/* Legend */}
                    <div className="space-y-2">
                      {allocations.map((alloc) => (
                        <div key={alloc.symbol} className="flex justify-between items-center text-xs">
                          <div className="flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${alloc.color}`} />
                            <span className="font-bold text-foreground">{alloc.symbol}</span>
                          </div>
                          <span className="font-mono text-muted-foreground">
                            ${alloc.value.toFixed(2)} ({alloc.percent.toFixed(1)}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Section 4: Recent Activity Feed */}
              <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col space-y-4">
                <div className="flex items-center gap-2 text-primary border-b border-border/40 pb-2">
                  <History size={16} />
                  <h3 className="font-black text-xs uppercase tracking-wider text-card-foreground">Audit Activity Logs</h3>
                </div>

                <div className="max-h-[350px] overflow-y-auto pr-1 space-y-3.5 text-xs">
                  {recentActivities.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-6">
                      No recent activities logged in audit feed.
                    </p>
                  ) : (
                    recentActivities.map((act) => (
                      <div 
                        key={act.id} 
                        className="flex gap-2.5 items-start border-l-2 pl-3 py-0.5 border-border hover:border-primary transition-all"
                      >
                        <div className="space-y-1 flex-1">
                          <p className="text-foreground leading-normal font-medium">{act.message}</p>
                          <span className="text-[10px] text-muted-foreground font-mono block">
                            {act.timestamp.toLocaleDateString()} {act.timestamp.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

          </div>

        </main>
      </div>
    </div>
  );
}
