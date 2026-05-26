"use client";

import React, { useEffect, useState, useRef } from "react";
import { useDashboardStore } from "@/store/dashboard/useDashboardStore";
import { Activity } from "lucide-react";

interface Trade {
  id: string;
  time: string;
  price: number;
  size: number;
  side: "BUY" | "SELL";
}

export default function MarketPulse() {
  const selectedSymbol = useDashboardStore((state) => state.selectedSymbol);
  const ticker = useDashboardStore((state) => state.tickerData[selectedSymbol]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const tickerRef = useRef(ticker);

  // Sync ref with ticker state to prevent hook dependency re-runs
  useEffect(() => {
    tickerRef.current = ticker;
  }, [ticker]);

  // 1. Initialize trade history list
  useEffect(() => {
    const basePrice = tickerRef.current?.price || (selectedSymbol === "BTCUSDT" ? 96000 : selectedSymbol === "ETHUSDT" ? 3400 : 140);
    const initialTrades: Trade[] = Array.from({ length: 8 }).map((_, index) => {
      const isBuy = Math.random() > 0.5;
      const offset = (Math.random() - 0.5) * (basePrice * 0.0005);
      const time = new Date(Date.now() - (8 - index) * 2000);
      
      return {
        id: `init-${index}`,
        time: time.toTimeString().split(" ")[0],
        price: basePrice + offset,
        size: parseFloat((Math.random() * (selectedSymbol === "BTCUSDT" ? 0.2 : selectedSymbol === "ETHUSDT" ? 1.5 : 15)).toFixed(4)),
        side: isBuy ? "BUY" : "SELL",
      };
    });
    
    setTrades(initialTrades);
  }, [selectedSymbol]);

  // 2. Setup interval for ticking new trades
  useEffect(() => {
    let timer: NodeJS.Timeout;

    const tick = () => {
      const basePrice = tickerRef.current?.price || (selectedSymbol === "BTCUSDT" ? 96000 : selectedSymbol === "ETHUSDT" ? 3400 : 140);
      const isBuy = Math.random() > 0.45; // slightly skewed to buy
      const offset = (Math.random() - 0.5) * (basePrice * 0.0004);
      const price = basePrice + offset;
      
      const newTrade: Trade = {
        id: Date.now().toString() + Math.random().toString(),
        time: new Date().toTimeString().split(" ")[0],
        price,
        size: parseFloat((Math.random() * (selectedSymbol === "BTCUSDT" ? 0.25 : selectedSymbol === "ETHUSDT" ? 2.0 : 25)).toFixed(4)),
        side: isBuy ? "BUY" : "SELL",
      };

      setTrades((prev) => {
        const next = [...prev, newTrade];
        if (next.length > 8) {
          next.shift();
        }
        return next;
      });

      // Schedule next tick randomly between 500ms and 2000ms
      const delay = Math.floor(Math.random() * 1500) + 500;
      timer = setTimeout(tick, delay);
    };

    timer = setTimeout(tick, 1000);

    return () => {
      clearTimeout(timer);
    };
  }, [selectedSymbol]);

  const formatPrice = (price: number) => {
    return price.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const getSpread = () => {
    if (!ticker) return "0.01%";
    // Spread is usually very small on Binance spot
    const spreadPct = (0.01 + Math.random() * 0.01).toFixed(2);
    return `${spreadPct}%`;
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex flex-col h-[350px]">
      <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/85 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 text-blue-400">
          <Activity size={16} />
          <h3 className="font-bold text-white text-sm">Market Pulse</h3>
        </div>
        <span className="text-[10px] text-slate-500 font-mono">Live Trades</span>
      </div>

      {/* Spread panel */}
      <div className="px-4 py-2 bg-slate-950/45 border-b border-slate-800/60 flex items-center justify-between text-[10px] text-slate-400 font-mono shrink-0">
        <span>Spread: <b className="text-slate-200">{getSpread()}</b></span>
        <span>Depth: <b className="text-green-500">Strong</b></span>
      </div>

      {/* Trades Table */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-800/40 text-[9px] uppercase font-bold text-slate-500 tracking-wider">
              <th className="px-4 py-1.5">Time</th>
              <th className="px-4 py-1.5 text-right">Price</th>
              <th className="px-4 py-1.5 text-right">Size</th>
              <th className="px-4 py-1.5 text-right">Total (USDT)</th>
            </tr>
          </thead>
          <tbody>
            {trades.slice().reverse().map((trade) => {
              const total = trade.price * trade.size;
              const sideColor = trade.side === "BUY" ? "text-green-400" : "text-red-400";
              
              return (
                <tr 
                  key={trade.id} 
                  className="hover:bg-slate-850/30 transition-colors border-b border-slate-850/10"
                >
                  <td className="px-4 py-2 font-mono text-slate-500 text-[10px]">{trade.time}</td>
                  <td className={`px-4 py-2 text-right font-mono font-semibold ${sideColor}`}>
                    ${formatPrice(trade.price)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-slate-300">{trade.size.toFixed(4)}</td>
                  <td className="px-4 py-2 text-right font-mono text-slate-400">
                    ${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
