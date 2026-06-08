"use client";

import React, { useState, useEffect } from "react";
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  RefreshCw, 
  Coins, 
  Briefcase,
  Activity,
  Award,
  Layers
} from "lucide-react";
import MCXLoader from "@/components/mcx/MCXLoader";
import { StatCard } from "@/components/shared/StatCard";

interface McxWallet {
  balance: number;
  availableBalance: number;
  blockedMargin: number;
  realizedPnL: number;
  unrealizedPnL: number;
}

interface McxOpenPosition {
  id: string;
  symbol: string;
  direction: string;
  lots: number;
  entryPrice: number;
  currentPrice: number;
  marginUsed: number;
  unrealizedPnL: number;
  status: string;
}

interface McxClosedStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
}

interface McxCommodityExposure {
  symbol: string;
  openLots: number;
  marginUsed: number;
  exposureValue: number;
}

export default function McxPortfolioPage() {
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState<McxWallet | null>(null);
  const [openPositions, setOpenPositions] = useState<McxOpenPosition[]>([]);
  const [closedStats, setClosedStats] = useState<McxClosedStats | null>(null);
  const [commodityExposure, setCommodityExposure] = useState<McxCommodityExposure[]>([]);

  // Indian Rupee formatting
  const formatRupee = (value: number) => {
    if (value === undefined || isNaN(value)) return "₹0.00";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const fetchPortfolio = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/mcx/portfolio");
      const data = await res.json();
      if (data && data.success) {
        setWallet(data.wallet);
        setOpenPositions(data.openPositions || []);
        setClosedStats(data.closedStats || null);
        setCommodityExposure(data.commodityExposure || []);
      }
    } catch (err) {
      console.error("Failed to fetch portfolio:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolio();
    
    // Auto refresh every 5 seconds for live PnL updates
    const interval = setInterval(() => {
       fetchPortfolio();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const totalPortfolioValue = wallet ? (wallet.availableBalance + wallet.blockedMargin + (wallet.unrealizedPnL || 0)) : 0;

  if (loading && !wallet) {
    return <MCXLoader message="Hydrating portfolio..." />;
  }

  const hasActivity = openPositions.length > 0 || (closedStats && closedStats.totalTrades > 0) || (wallet && wallet.blockedMargin > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight text-foreground flex items-center gap-2">
            <Briefcase className="text-primary" size={24} />
            MCX Portfolio
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Centralized capital management, active positions, and margin accounting.
          </p>
        </div>
        <button
          onClick={fetchPortfolio}
          className="p-2.5 bg-secondary/80 hover:bg-secondary border border-border rounded-xl transition-all shadow-sm"
        >
          <RefreshCw size={15} className="text-primary" />
        </button>
      </div>

      {/* Top Summary Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Total Portfolio Value"
          value={formatRupee(totalPortfolioValue)}
          subValue="Available + Margin + PnL"
          icon={Layers}
        />
        <StatCard
          title="Available Cash"
          value={formatRupee(wallet?.availableBalance || 0)}
          subValue="Liquid capital for new trades"
          icon={Wallet}
        />
        <StatCard
          title="Margin In Use"
          value={formatRupee(wallet?.blockedMargin || 0)}
          subValue="Capital blocked in open positions"
          icon={Coins}
        />
        <StatCard
          title="Total Realized PnL"
          value={formatRupee(wallet?.realizedPnL || 0)}
          subValue={
            (wallet?.realizedPnL || 0) >= 0 ? (
              <span className="flex items-center gap-1 text-emerald-500">
                <TrendingUp className="h-3.5 w-3.5" /> Net Gain
              </span>
            ) : (
              <span className="flex items-center gap-1 text-red-500">
                <TrendingDown className="h-3.5 w-3.5" /> Net Loss
              </span>
            )
          }
          icon={Activity}
          trend={(wallet?.realizedPnL || 0) >= 0 ? "up" : "down"}
        />
      </div>

      {!hasActivity ? (
        <div className="flex flex-col items-center justify-center py-20 bg-card border border-dashed border-border rounded-2xl">
          <div className="p-4 bg-secondary rounded-full mb-4">
            <Briefcase className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-black uppercase tracking-widest text-foreground">No Active Commodity Positions</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-md text-center">
            Your centralized wallet is active, but you have no open positions or trading history in the MCX module.
          </p>
        </div>
      ) : (
        <>
          {/* Open Positions Table */}
          {openPositions.length > 0 && (
            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden animate-fade-in">
              <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-secondary/10">
                <h3 className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                  <Activity size={16} className="text-primary" />
                  Open Positions
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border bg-secondary/20 font-black uppercase tracking-wider text-muted-foreground text-[10px]">
                      <th className="px-6 py-4">Commodity</th>
                      <th className="px-6 py-4">Direction</th>
                      <th className="px-6 py-4 text-right">Lots</th>
                      <th className="px-6 py-4 text-right">Entry Price</th>
                      <th className="px-6 py-4 text-right">Current Price</th>
                      <th className="px-6 py-4 text-right">Margin Used</th>
                      <th className="px-6 py-4 text-right">Unrealized PnL</th>
                      <th className="px-6 py-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {openPositions.map((pos) => {
                      const isLong = pos.direction === "LONG";
                      // Mocking Unrealized PnL for UI (since backend sends 0 or we compute it if currentPrice updates)
                      const isProfit = pos.unrealizedPnL >= 0;
                      return (
                        <tr key={pos.id} className="hover:bg-secondary/10 transition-colors">
                          <td className="px-6 py-4 font-black tracking-wider">{pos.symbol}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${isLong ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-rose-500/10 text-rose-500 border border-rose-500/20"}`}>
                              {pos.direction}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right font-bold">{pos.lots}</td>
                          <td className="px-6 py-4 text-right font-mono text-muted-foreground">{formatRupee(pos.entryPrice)}</td>
                          <td className="px-6 py-4 text-right font-mono">{formatRupee(pos.currentPrice)}</td>
                          <td className="px-6 py-4 text-right font-mono font-medium">{formatRupee(pos.marginUsed)}</td>
                          <td className={`px-6 py-4 text-right font-mono font-black ${isProfit ? "text-emerald-500" : "text-rose-500"}`}>
                            {isProfit ? "+" : ""}{formatRupee(pos.unrealizedPnL)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="px-2 py-1 rounded border border-primary/20 bg-primary/10 text-[9px] font-bold text-primary uppercase">
                              {pos.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Bottom Grid: Commodity Exposure & Closed Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
            {/* Commodity Exposure Table */}
            {commodityExposure.length > 0 && (
              <div className="lg:col-span-2 bg-card border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col h-full">
                <div className="px-6 py-4 border-b border-border bg-secondary/10">
                  <h3 className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                    <Layers size={16} className="text-orange-500" />
                    Commodity Exposure
                  </h3>
                </div>
                <div className="overflow-x-auto flex-1">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border bg-secondary/20 font-black uppercase tracking-wider text-muted-foreground text-[10px]">
                        <th className="px-6 py-4">Commodity</th>
                        <th className="px-6 py-4 text-right">Open Lots</th>
                        <th className="px-6 py-4 text-right">Exposure Value</th>
                        <th className="px-6 py-4 text-right">Margin Used</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {commodityExposure.map((exposure) => (
                        <tr key={exposure.symbol} className="hover:bg-secondary/10 transition-colors">
                          <td className="px-6 py-4 font-black tracking-wider text-foreground">{exposure.symbol}</td>
                          <td className="px-6 py-4 text-right font-bold">{exposure.openLots}</td>
                          <td className="px-6 py-4 text-right font-mono text-muted-foreground">{formatRupee(exposure.exposureValue)}</td>
                          <td className="px-6 py-4 text-right font-mono font-medium">{formatRupee(exposure.marginUsed)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Closed Positions Summary */}
            {closedStats && (
              <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-6">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-2 mb-1">
                    <Award size={16} className="text-purple-500" />
                    Closed Positions Summary
                  </h3>
                  <p className="text-[10px] text-muted-foreground">Lifetime statistics from closed MCX trades.</p>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-border/50 pb-2">
                    <span className="text-[10px] font-black uppercase text-muted-foreground">Total Trades</span>
                    <span className="font-mono font-bold text-foreground text-sm">{closedStats.totalTrades}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-border/50 pb-2">
                    <span className="text-[10px] font-black uppercase text-muted-foreground">Winning Trades</span>
                    <span className="font-mono font-bold text-emerald-500 text-sm">{closedStats.winningTrades}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-border/50 pb-2">
                    <span className="text-[10px] font-black uppercase text-muted-foreground">Losing Trades</span>
                    <span className="font-mono font-bold text-rose-500 text-sm">{closedStats.losingTrades}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-xs font-black uppercase text-foreground">Win Rate</span>
                    <span className={`font-mono font-black text-xl tracking-tighter ${closedStats.winRate >= 50 ? 'text-emerald-500' : 'text-amber-500'}`}>
                      {closedStats.winRate.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
