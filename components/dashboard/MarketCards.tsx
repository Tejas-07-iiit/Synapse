"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useDashboardStore } from "@/store/dashboard/useDashboardStore";
import { useWalletStore } from "@/src/stores/walletStore";
import { useAuthStore } from "@/store/useAuthStore";
import { Wallet, TrendingUp, Activity } from "lucide-react";

interface Position {
  id: string;
  userId: string;
  symbol: string;
  direction: "LONG" | "SHORT";
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  stopLoss: number | null;
  takeProfit: number | null;
  leverage: number;
  pnl: number;
  status: string;
  openedAt: string | number;
  closedAt: string | number | null;
}

export default function MarketCards() {
  const selectedSymbol = useDashboardStore((state) => state.selectedSymbol);
  const ticker = useDashboardStore((state) => state.tickerData[selectedSymbol]);
  const tickerData = useDashboardStore((state) => state.tickerData);
  
  const { user } = useAuthStore();
  const wallet = useWalletStore();
  const fetchWallet = useWalletStore((state) => state.fetchWallet);
  
  const [activePositions, setActivePositions] = useState<Position[]>([]);

  useEffect(() => {
    if (user?.id) {
      fetchWallet(user.id);
    }
  }, [user?.id, fetchWallet]);

  useEffect(() => {
    if (!user?.id) return;
    const fetchPositions = async () => {
      try {
        const res = await fetch(`/api/positions?userId=${user.id}&type=active`);
        const data = await res.json();
        if (data.success) {
          setActivePositions(data.positions || []);
        }
      } catch (err) {
        console.error("Failed to fetch active positions", err);
      }
    };
    fetchPositions();
    const interval = setInterval(fetchPositions, 4000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const formatPrice = (price: number | undefined) => {
    if (price === undefined) return "Loading...";
    return price.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  };

  const getChangeSign = (change: number | undefined) => {
    if (change === undefined) return "";
    return change >= 0 ? "+" : "";
  };

  const usedMargin = useMemo(() => {
    let total = 0;
    activePositions.forEach((pos) => {
      const entryPrice = pos.entryPrice;
      const quantity = pos.quantity;
      const leverage = pos.leverage || 1;
      total += (entryPrice * quantity) / leverage;
    });
    return total;
  }, [activePositions]);

  const unrealizedPnl = useMemo(() => {
    let total = 0;
    activePositions.forEach((pos) => {
      const livePrice = tickerData[pos.symbol]?.price || pos.currentPrice || pos.entryPrice;
      const isLong = pos.direction === "LONG";
      
      const currentPrice = livePrice;
      const entryVal = pos.entryPrice * pos.quantity;
      const currentVal = currentPrice * pos.quantity;
      
      const pnl = isLong 
        ? currentVal - entryVal
        : entryVal - currentVal;
      
      total += pnl;
    });
    return total;
  }, [activePositions, tickerData]);

  const availableBalance = wallet.balance - usedMargin;
  const portfolioValue = wallet.balance + unrealizedPnl;
  const dailyGain = wallet.totalDeposited > 0 ? ((portfolioValue - wallet.totalDeposited) / wallet.totalDeposited) * 100 : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {/* Wallet Balance */}
      <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
        <div className="space-y-1">
          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest block">
            Wallet Balance
          </span>
          <span className="text-lg font-bold text-foreground block">
            ${availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-muted-foreground/60 block font-medium uppercase tracking-tight">USDT Available</span>
        </div>
        <div className="p-3 bg-primary/10 rounded-xl border border-primary/20 text-primary shadow-inner">
          <Wallet size={18} />
        </div>
      </div>

      {/* Portfolio Value */}
      <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
        <div className="space-y-1">
          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest block">
            Net Asset Value
          </span>
          <span className="text-lg font-bold text-foreground block">
            ${portfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className={`text-[10px] font-bold block uppercase tracking-tight ${dailyGain >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
            {dailyGain >= 0 ? "+" : ""}{dailyGain.toFixed(2)}% Total ROI
          </span>
        </div>
        <div className={`p-3 rounded-xl border shadow-inner ${dailyGain >= 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-destructive/10 border-destructive/20 text-destructive'}`}>
          <TrendingUp size={18} />
        </div>
      </div>

      {/* Active Asset WebSocket Info */}
      <div className="bg-card border border-primary/30 rounded-xl p-4 flex items-center justify-between col-span-1 lg:col-span-2 shadow-sm hover:shadow-md transition-shadow ring-1 ring-primary/5">
        <div className="space-y-1 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
              {selectedSymbol} Realtime
            </span>
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-foreground tracking-tight">
              ${formatPrice(ticker?.price)}
            </span>
            {ticker && (
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${ticker.priceChangePercent24h >= 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                {getChangeSign(ticker.priceChangePercent24h)}
                {ticker.priceChangePercent24h.toFixed(2)}%
              </span>
            )}
          </div>
          {ticker ? (
            <div className="flex gap-4 text-[10px] text-muted-foreground font-medium uppercase tracking-tight">
              <span>High: <b className="text-foreground font-bold">${formatPrice(ticker.high24h)}</b></span>
              <span>Low: <b className="text-foreground font-bold">${formatPrice(ticker.low24h)}</b></span>
              <span>Vol: <b className="text-foreground font-bold">{ticker.volume24h.toLocaleString(undefined, { maximumFractionDigits: 0 })}</b></span>
            </div>
          ) : (
            <span className="text-[10px] text-muted-foreground/50 block animate-pulse">Connecting stream...</span>
          )}
        </div>
        <div className="p-3 bg-primary/10 rounded-xl border border-primary/20 text-primary shadow-inner hidden sm:block">
          <Activity size={18} />
        </div>
      </div>
    </div>
  );
}

