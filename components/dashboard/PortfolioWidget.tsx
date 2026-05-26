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
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 flex flex-col h-[350px]">
      <div className="flex items-center gap-2 mb-4 text-blue-400 shrink-0">
        <Briefcase size={16} />
        <h3 className="font-bold text-white text-sm">Active Positions</h3>
      </div>

      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
              <th className="pb-2">Market</th>
              <th className="pb-2">Side</th>
              <th className="pb-2 text-right">Size</th>
              <th className="pb-2 text-right">Entry</th>
              <th className="pb-2 text-right">Mark Price</th>
              <th className="pb-2 text-right">PnL (USDT)</th>
            </tr>
          </thead>
          <tbody>
            {mockPositions.map((pos) => {
              const { pnl, percent, currentPrice } = calculatePnL(pos);
              const cleanSym = pos.symbol.replace("USDT", "");
              
              return (
                <tr key={pos.symbol} className="border-b border-slate-850 py-2 hover:bg-slate-850/20">
                  <td className="py-2.5 font-bold text-white">{cleanSym}</td>
                  <td className="py-2.5">
                    <span className="bg-green-950 text-green-400 px-1.5 py-0.5 rounded font-black text-[9px]">
                      {pos.type}
                    </span>
                  </td>
                  <td className="py-2.5 text-right font-mono text-slate-300">{pos.size}</td>
                  <td className="py-2.5 text-right font-mono text-slate-400">${formatPrice(pos.entryPrice)}</td>
                  <td className="py-2.5 text-right font-mono text-slate-200">${formatPrice(currentPrice)}</td>
                  <td className={`py-2.5 text-right font-mono font-bold ${getPnLColor(pnl)}`}>
                    <span className="flex items-center justify-end gap-1">
                      {pnl >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      ${formatPrice(pnl)} ({pnl >= 0 ? "+" : ""}{percent.toFixed(2)}%)
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      <div className="border-t border-slate-800 pt-3 flex items-center justify-between text-[10px] text-slate-500 shrink-0">
        <span>Margin Ratio: <b className="text-green-500">1.4%</b></span>
        <span>Maintenance Margin: <b className="text-slate-300">$185.20 USDT</b></span>
      </div>
    </div>
  );
}
