"use client";

import React from "react";
import { useDashboardStore } from "@/store/dashboard/useDashboardStore";
import { Briefcase, TrendingUp, TrendingDown } from "lucide-react";

interface Position {
  symbol: string;
  type: "BUY" | "SELL";
  entryPrice: number;
  size: number;
}

const mockPositions: Position[] = [
  {
    symbol: "BTCUSDT",
    type: "BUY",
    entryPrice: 95800.0,
    size: 0.15,
  },
  {
    symbol: "ETHUSDT",
    type: "BUY",
    entryPrice: 3380.0,
    size: 1.2,
  },
];

export default function PortfolioWidget() {
  const tickerData = useDashboardStore((state) => state.tickerData);

  const calculatePnL = (pos: Position) => {
    const ticker = tickerData[pos.symbol];
    if (!ticker) return { pnl: 0, percent: 0, currentPrice: pos.entryPrice };
    
    const currentPrice = ticker.price;
    const priceDiff = currentPrice - pos.entryPrice;
    const pnl = pos.type === "BUY" ? priceDiff * pos.size : -priceDiff * pos.size;
    const percent = (priceDiff / pos.entryPrice) * 100 * (pos.type === "BUY" ? 1 : -1);
    
    return { pnl, percent, currentPrice };
  };

  const getPnLColor = (pnl: number) => {
    return pnl >= 0 ? "text-green-500" : "text-red-500";
  };

  const formatPrice = (val: number) => {
    return val.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col h-[350px] shadow-sm">
      <div className="flex items-center gap-2 mb-4 text-primary shrink-0">
        <Briefcase size={16} />
        <h3 className="font-bold text-card-foreground text-sm uppercase tracking-wider">Active Positions</h3>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-border text-[10px] uppercase font-bold text-muted-foreground tracking-widest bg-muted/30">
              <th className="px-2 py-2">Market</th>
              <th className="px-2 py-2">Side</th>
              <th className="px-2 py-2 text-right">Size</th>
              <th className="px-2 py-2 text-right">Entry</th>
              <th className="px-2 py-2 text-right">Mark Price</th>
              <th className="px-2 py-2 text-right">PnL (USDT)</th>
            </tr>
          </thead>
          <tbody>
            {mockPositions.map((pos) => {
              const { pnl, percent, currentPrice } = calculatePnL(pos);
              const cleanSym = pos.symbol.replace("USDT", "");
              
              return (
                <tr key={pos.symbol} className="border-b border-border/50 py-2 hover:bg-muted/50 transition-colors group">
                  <td className="px-2 py-3 font-bold text-foreground">{cleanSym}</td>
                  <td className="px-2 py-3">
                    <span className={`${pos.type === 'BUY' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'} border px-1.5 py-0.5 rounded font-black text-[9px]`}>
                      {pos.type}
                    </span>
                  </td>
                  <td className="px-2 py-3 text-right font-mono text-muted-foreground group-hover:text-foreground transition-colors">{pos.size}</td>
                  <td className="px-2 py-3 text-right font-mono text-muted-foreground/80 font-medium">${formatPrice(pos.entryPrice)}</td>
                  <td className="px-2 py-3 text-right font-mono text-foreground font-semibold">${formatPrice(currentPrice)}</td>
                  <td className={`px-2 py-3 text-right font-mono font-bold ${getPnLColor(pnl)}`}>
                    <div className="flex flex-col items-end">
                      <span className="flex items-center justify-end gap-1">
                        {pnl >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        ${formatPrice(pnl)}
                      </span>
                      <span className="text-[10px] opacity-80">{pnl >= 0 ? "+" : ""}{percent.toFixed(2)}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      <div className="border-t border-border pt-3 mt-2 flex items-center justify-between text-[10px] text-muted-foreground font-medium uppercase tracking-tight shrink-0">
        <span>Margin Ratio: <b className="text-green-500 font-bold">1.4%</b></span>
        <span>Maint. Margin: <b className="text-foreground font-bold">$185.20 USDT</b></span>
      </div>
    </div>
  );
}
