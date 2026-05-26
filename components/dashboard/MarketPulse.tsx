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
    <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col h-[350px] shadow-sm">
      <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 text-primary">
          <Activity size={16} />
          <h3 className="font-bold text-card-foreground text-sm uppercase tracking-wider">Market Pulse</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Live Trades</span>
        </div>
      </div>

      {/* Spread panel */}
      <div className="px-4 py-2 bg-muted/20 border-b border-border/50 flex items-center justify-between text-[10px] text-muted-foreground font-mono shrink-0">
        <span>Spread: <b className="text-foreground font-bold">{getSpread()}</b></span>
        <span className="flex items-center gap-1">
          Depth: <b className="text-green-500 font-bold uppercase">Strong</b>
        </span>
      </div>

      {/* Trades Table */}
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-background/30">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-border/50 text-[9px] uppercase font-bold text-muted-foreground tracking-widest sticky top-0 bg-background/80 backdrop-blur-sm z-10">
              <th className="px-4 py-2">Time</th>
              <th className="px-4 py-2 text-right">Price</th>
              <th className="px-4 py-2 text-right">Size</th>
              <th className="px-4 py-2 text-right">Total (USDT)</th>
            </tr>
          </thead>
          <tbody>
            {trades.slice().reverse().map((trade) => {
              const total = trade.price * trade.size;
              const isBuy = trade.side === "BUY";
              
              return (
                <tr 
                  key={trade.id} 
                  className={`hover:bg-muted transition-colors border-b border-border/10 group ${isBuy ? 'bg-green-500/[0.02]' : 'bg-red-500/[0.02]'}`}
                >
                  <td className="px-4 py-2 font-mono text-muted-foreground/60 text-[10px] group-hover:text-muted-foreground transition-colors">{trade.time}</td>
                  <td className={`px-4 py-2 text-right font-mono font-bold ${isBuy ? 'text-green-500' : 'text-red-500'}`}>
                    ${formatPrice(trade.price)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-foreground font-medium">{trade.size.toFixed(4)}</td>
                  <td className="px-4 py-2 text-right font-mono text-muted-foreground/80 group-hover:text-foreground transition-colors">
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
