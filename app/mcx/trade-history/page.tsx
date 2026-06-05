"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  TrendingUp, 
  TrendingDown, 
  RefreshCw, 
  Clock, 
  ExternalLink,
  ShieldAlert,
  SlidersHorizontal
} from "lucide-react";
import MCXLoader from "@/components/mcx/MCXLoader";

interface TradeItem {
  _id: string;
  tradeId: string;
  symbol: string;
  side: string;
  positionSide: string;
  lots: number;
  quantity: number;
  price: number;
  entryPrice: number;
  exitPrice: number;
  strategy: string;
  aiConfidence: number;
  profit: number;
  status: string;
  createdAt: string;
}

export default function McxTradeHistoryPage() {
  const [trades, setTrades] = useState<TradeItem[]>([]);
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

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/mcx/trade/history");
      const data = await res.json();
      if (data && data.success && data.data) {
        setTrades(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch trade history:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    } catch (e) {
      return isoString;
    }
  };

  const getSideBadge = (side: string) => {
    const maps: Record<string, string> = {
      LONG_BUY: "text-green-500 bg-green-500/10 border-green-500/20",
      LONG_SELL: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
      SHORT_SELL: "text-red-500 bg-red-500/10 border-red-500/20",
      SHORT_CLOSE: "text-rose-500 bg-rose-500/10 border-rose-500/20",
    };
    return maps[side] || "text-muted-foreground bg-muted";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight text-foreground">
            MCX Trade Records
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Audit logs of all automated and manual commodity executions.
          </p>
        </div>
        <button
          onClick={fetchHistory}
          className="p-2.5 bg-muted/40 hover:bg-muted/80 border border-border rounded-xl transition-all"
        >
          <RefreshCw size={15} className="text-orange-500" />
        </button>
      </div>

      {/* Trade list */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm flex flex-col h-full min-h-[500px]">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center h-[400px]">
            <MCXLoader fullscreen={false} message="Fetching trade records..." />
          </div>
        ) : trades.length > 0 ? (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b border-border bg-secondary/20 dark:bg-[#11131c]/50 text-[10px] font-black uppercase tracking-widest text-muted-foreground dark:text-[#94a3b8]">
                  <th className="p-4 pl-6 font-bold">Trade ID / Time</th>
                  <th className="p-4 font-bold">Commodity</th>
                  <th className="p-4 font-bold">Direction</th>
                  <th className="p-4 font-bold">Lots</th>
                  <th className="p-4 font-bold">Execution Price</th>
                  <th className="p-4 font-bold">Strategy</th>
                  <th className="p-4 font-bold">Profit / Loss</th>
                  <th className="p-4 pr-6 font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs">
                {trades.map((trade) => {
                  const isProfit = trade.profit >= 0;
                  return (
                    <tr 
                      key={trade._id}
                      className="hover:bg-muted/10 transition-colors font-medium"
                    >
                      <td className="p-4 pl-6 space-y-1">
                        <div className="font-mono font-bold text-foreground">
                          {trade.tradeId}
                        </div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1 font-semibold">
                          <Clock size={11} />
                          {formatDate(trade.createdAt)}
                        </div>
                      </td>
                      <td className="p-4 font-black tracking-wider text-foreground">
                        {trade.symbol}
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 text-[9px] uppercase border rounded font-black tracking-wider ${
                          getSideBadge(trade.side)
                        }`}>
                          {trade.side.replace("_", " ")}
                        </span>
                      </td>
                      <td className="p-4 font-mono font-bold text-foreground">
                        {trade.lots}
                      </td>
                      <td className="p-4 font-mono text-foreground font-bold">
                        {formatRupee(trade.price)}
                      </td>
                      <td className="p-4 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                        {trade.strategy}
                      </td>
                      <td className={`p-4 font-mono font-bold ${
                        trade.status === "CLOSED"
                          ? isProfit ? "text-green-500" : "text-red-500"
                          : "text-muted-foreground"
                      }`}>
                        {trade.status === "CLOSED" ? formatRupee(trade.profit) : "Pending Exit"}
                      </td>
                      <td className="p-4 pr-6">
                        <span className={`px-2 py-0.5 text-[9px] uppercase border rounded-md font-black tracking-widest ${
                          trade.status === "OPEN"
                            ? "text-orange-500 bg-orange-500/10 border-orange-500/20"
                            : "text-muted-foreground bg-muted border-border"
                        }`}>
                          {trade.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="p-4 bg-muted/40 border border-border rounded-full">
              <SlidersHorizontal className="text-muted-foreground/60 h-8 w-8" />
            </div>
            <div>
              <p className="font-bold text-foreground">No Trades Found</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Start the automated bot to begin executing market positions.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
