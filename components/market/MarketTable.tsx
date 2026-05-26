"use client";

import React, { useEffect, useRef, useState } from "react";
import { useDashboardStore } from "@/store/dashboard/useDashboardStore";
import { TickerInfo } from "@/types/market";

interface RowProps {
  ticker: TickerInfo | undefined;
  symbol: string;
  isSelected: boolean;
  onClick: () => void;
}

export function WatchlistRow({ ticker, symbol, isSelected, onClick }: RowProps) {
  const prevPriceRef = useRef<number | undefined>(undefined);
  const [flashClass, setFlashClass] = useState<string>("");

  useEffect(() => {
    if (ticker && prevPriceRef.current !== undefined) {
      if (ticker.price > prevPriceRef.current) {
        setFlashClass("bg-green-500/20 text-green-400");
        const timer = setTimeout(() => setFlashClass(""), 300);
        prevPriceRef.current = ticker.price;
        return () => clearTimeout(timer);
      } else if (ticker.price < prevPriceRef.current) {
        setFlashClass("bg-red-500/20 text-red-400");
        const timer = setTimeout(() => setFlashClass(""), 300);
        prevPriceRef.current = ticker.price;
        return () => clearTimeout(timer);
      }
    }
    if (ticker && prevPriceRef.current === undefined) {
      prevPriceRef.current = ticker.price;
    }
  }, [ticker]);

  const cleanSymbol = symbol.replace("USDT", "");

  const formatPrice = (price: number | undefined) => {
    if (price === undefined) return "Loading...";
    return price.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const getChangePercent = () => {
    if (!ticker) return "—";
    const sign = ticker.priceChangePercent24h >= 0 ? "+" : "";
    const color = ticker.priceChangePercent24h >= 0 ? "text-green-500" : "text-red-500";
    return <span className={`font-semibold ${color}`}>{sign}{ticker.priceChangePercent24h.toFixed(2)}%</span>;
  };

  const getVolume = () => {
    if (!ticker) return "—";
    const volumeUsdt = ticker.volume24h * ticker.price;
    if (volumeUsdt >= 1.0e9) {
      return `$${(volumeUsdt / 1.0e9).toFixed(2)}B`;
    }
    if (volumeUsdt >= 1.0e6) {
      return `$${(volumeUsdt / 1.0e6).toFixed(1)}M`;
    }
    return `$${volumeUsdt.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };

  return (
    <tr
      onClick={onClick}
      className={`cursor-pointer hover:bg-slate-800/40 border-b border-slate-800/50 transition ${
        isSelected ? "bg-slate-800/80 border-l-2 border-l-blue-500" : ""
      }`}
    >
      <td className="px-4 py-3 font-semibold text-white text-sm">{cleanSymbol}</td>
      <td className={`px-4 py-3 font-mono text-sm text-right transition-colors duration-300 ${flashClass}`}>
        ${formatPrice(ticker?.price)}
      </td>
      <td className="px-4 py-3 text-right text-sm">{getChangePercent()}</td>
      <td className="px-4 py-3 text-right text-xs text-slate-400 font-mono">{getVolume()}</td>
    </tr>
  );
}

export default function MarketTable() {
  const selectedSymbol = useDashboardStore((state) => state.selectedSymbol);
  const supportedSymbols = useDashboardStore((state) => state.supportedSymbols);
  const tickerData = useDashboardStore((state) => state.tickerData);
  const setSymbol = useDashboardStore((state) => state.setSymbol);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex flex-col h-[350px]">
      <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between shrink-0">
        <h3 className="font-bold text-white text-sm">Crypto Watchlist</h3>
        <span className="text-[10px] text-slate-500 font-mono">Binance Spot</span>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
              <th className="px-4 py-2">Asset</th>
              <th className="px-4 py-2 text-right">Price</th>
              <th className="px-4 py-2 text-right">24h Chg</th>
              <th className="px-4 py-2 text-right">Volume</th>
            </tr>
          </thead>
          <tbody>
            {supportedSymbols.map((sym) => (
              <WatchlistRow
                key={sym}
                symbol={sym}
                ticker={tickerData[sym]}
                isSelected={selectedSymbol === sym}
                onClick={() => setSymbol(sym)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
