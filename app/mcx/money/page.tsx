"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  ArrowUpRight, 
  RefreshCw, 
  Coins, 
  ShieldCheck 
} from "lucide-react";
import MCXLoader from "@/components/mcx/MCXLoader";

import { StatCard } from "@/components/shared/StatCard";

interface CommodityState {
  commodity: string;
  availableBalance: number;
  holdings: number;
  averageBuyPrice: number;
  totalProfit: number;
  totalLoss: number;
  realTotalProfit: number;
  totalInvestedAmount: number;
}

export default function McxMoneyPage() {
  const [states, setStates] = useState<CommodityState[]>([]);
  const [loading, setLoading] = useState(true);

  // Indian Rupee formatting
  const formatRupee = (value: number) => {
    if (value === undefined || isNaN(value)) return "₹0.00";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const fetchBalances = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/mcx/bot/state");
      const data = await res.json();
      if (data && data.success && data.states) {
        setStates(data.states);
      }
    } catch (err) {
      console.error("Failed to fetch wallet balances:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBalances();
  }, []);

  // Compute aggregated stats
  const totalCapital = states.reduce((sum, s) => sum + (s.availableBalance || 0), 0);
  const totalRealizedProfit = states.reduce((sum, s) => sum + (s.realTotalProfit || 0), 0);
  const totalInvested = states.reduce((sum, s) => sum + (s.holdings * s.averageBuyPrice), 0);

  if (loading) {
    return <MCXLoader message="Hydrating wallet ledger..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight text-foreground">
            MCX Capital Account
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Overview of commodity capital, realized profit ledger, and margins.
          </p>
        </div>
        <button
          onClick={fetchBalances}
          className="p-2.5 bg-muted/40 hover:bg-muted/80 border border-border rounded-xl transition-all"
        >
          <RefreshCw size={15} className="text-orange-500" />
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Total Wallet Balance */}
        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              Total Account Balance
            </span>
            <span className="text-xl font-mono font-black mt-2 text-foreground tracking-tight">
              {formatRupee(totalCapital)}
            </span>
            <span className="text-[9px] text-muted-foreground font-semibold mt-1 uppercase flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-orange-500" /> Segregated MCX Ledger
            </span>
          </div>
          <div className="p-3 bg-primary/10 rounded-xl group-hover:scale-105 transition-transform duration-300 shadow-inner">
            <Wallet className="text-primary h-5 w-5" />
          </div>
        </div>

        {/* Card 2: Invested / Margin */}
        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              Active Margin Invested
            </span>
            <span className="text-xl font-mono font-black mt-2 text-foreground tracking-tight">
              {formatRupee(totalInvested)}
            </span>
            <span className="text-[9px] text-muted-foreground font-semibold mt-1 uppercase">
              Capital blocked in positions
            </span>
          </div>
          <div className="p-3 bg-primary/10 rounded-xl group-hover:scale-105 transition-transform duration-300 shadow-inner">
            <Coins className="text-orange-500 h-5 w-5" />
          </div>
        </div>

        {/* Card 3: Realized Profits */}
        <StatCard
          title="Total Realized Profits"
          value={formatRupee(totalRealizedProfit)}
          subValue={
            totalRealizedProfit >= 0 ? (
              <span className="flex items-center gap-1 text-emerald-500">
                <TrendingUp className="h-3.5 w-3.5 animate-bounce" /> Net Positive Gain
              </span>
            ) : (
              <span className="flex items-center gap-1 text-red-500">
                <TrendingDown className="h-3.5 w-3.5 animate-bounce" /> Net Loss
              </span>
            )
          }
          icon={ArrowUpRight}
          trend={totalRealizedProfit >= 0 ? "up" : "down"}
        />
      </div>

      {/* Commodity-wise Balances Breakdown */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-black uppercase tracking-wider text-foreground">
          Asset & Ledger Breakdown
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-border bg-secondary/20 dark:bg-[#11131c]/50 text-[10px] font-black uppercase tracking-widest text-muted-foreground dark:text-[#94a3b8]">
                <th className="p-4 pl-6 font-bold">Commodity</th>
                <th className="p-4 font-bold">Available Capital</th>
                <th className="p-4 font-bold">Holdings (Lots)</th>
                <th className="p-4 font-bold">Avg Entry Price</th>
                <th className="p-4 font-bold">Holdings Value</th>
                <th className="p-4 font-bold pr-6">Realized Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-xs">
              {states.map((state) => (
                <tr key={state.commodity} className="hover:bg-muted/10 transition-colors">
                  <td className="p-4 pl-6 font-black tracking-wider text-foreground">
                    {state.commodity}
                  </td>
                  <td className="p-4 font-mono font-bold">
                    {formatRupee(state.availableBalance)}
                  </td>
                  <td className="p-4 font-bold text-foreground">
                    {state.holdings} Lots
                  </td>
                  <td className="p-4 font-mono">
                    {formatRupee(state.averageBuyPrice)}
                  </td>
                  <td className="p-4 font-mono font-bold text-foreground">
                    {formatRupee(state.holdings * state.averageBuyPrice)}
                  </td>
                  <td className={`p-4 pr-6 font-mono font-bold ${
                    state.realTotalProfit >= 0 ? "text-green-500" : "text-red-500"
                  }`}>
                    {formatRupee(state.realTotalProfit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
