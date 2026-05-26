"use client";

import React, { useEffect, useRef, useState } from "react";
import { useDashboardStore } from "@/store/dashboard/useDashboardStore";
import { useMarketStore } from "@/store/market/useMarketStore";
import { TickerInfo, IndicatorValues, MarketAnalytics } from "@/types/market";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface RowProps {
  ticker: TickerInfo | undefined;
  symbol: string;
  isSelected: boolean;
  onClick: () => void;
  indicators: IndicatorValues | undefined;
  analytics: MarketAnalytics | undefined;
}

export function WatchlistRow({ 
  ticker, 
  symbol, 
  isSelected, 
  onClick,
  indicators,
  analytics
}: RowProps) {
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

  // State pill (Bullish/Bearish/Neutral)
  const getStatePill = () => {
    if (!analytics) return <span className="text-muted-foreground text-xs">—</span>;
    const state = analytics.trendDirection;
    if (state === "BULLISH") {
      return (
        <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-green-500/10 text-green-400 border border-green-500/20">
          BULL
        </span>
      );
    } else if (state === "BEARISH") {
      return (
        <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-red-500/10 text-red-400 border border-red-500/20">
          BEAR
        </span>
      );
    } else {
      return (
        <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-muted text-muted-foreground border border-border">
          NEUT
        </span>
      );
    }
  };

  // RSI display with overbought/oversold indicator
  const getRsiValue = () => {
    if (!indicators?.rsi || indicators.rsi.length === 0) return "—";
    const rsiVal = indicators.rsi[indicators.rsi.length - 1];
    if (rsiVal === undefined || isNaN(rsiVal)) return "—";
    
    let colorClass = "text-muted-foreground";
    if (rsiVal >= 70) colorClass = "text-orange-400 font-bold";
    else if (rsiVal <= 30) colorClass = "text-purple-400 font-bold";
    else colorClass = "text-foreground/90 font-mono";

    return <span className={`${colorClass}`}>{rsiVal.toFixed(1)}</span>;
  };

  // Momentum direction arrow/text
  const getMomentum = () => {
    if (!analytics) return "—";
    const mom = analytics.momentumScore;
    if (mom === "STRONG") {
      return (
        <span className="text-green-400 text-xs font-bold flex items-center justify-end gap-0.5">
          <TrendingUp size={12} /> UP
        </span>
      );
    } else if (mom === "WEAK") {
      return (
        <span className="text-red-400 text-xs font-bold flex items-center justify-end gap-0.5">
          <TrendingDown size={12} /> DN
        </span>
      );
    } else {
      return (
        <span className="text-muted-foreground text-xs flex items-center justify-end gap-0.5">
          <Minus size={12} /> FLAT
        </span>
      );
    }
  };

  return (
    <tr
      onClick={onClick}
      className={`cursor-pointer hover:bg-muted/50 border-b border-border/50 transition group ${
        isSelected ? "bg-primary/[0.08] border-l-4 border-l-primary" : "border-l-4 border-l-transparent"
      }`}
    >
      <td className="px-4 py-3.5 font-bold text-foreground text-sm group-hover:text-primary transition-colors">
        {cleanSymbol}
      </td>
      <td className={`px-4 py-3.5 font-mono text-sm text-right font-bold transition-all duration-300 ${flashClass}`}>
        ${formatPrice(ticker?.price)}
      </td>
      <td className="px-4 py-3.5 text-right text-sm">
        {getChangePercent()}
      </td>
      <td className="px-4 py-3.5 text-center">
        {getStatePill()}
      </td>
      <td className="px-4 py-3.5 text-right font-mono text-sm">
        {getRsiValue()}
      </td>
      <td className="px-4 py-3.5 text-right">
        {getMomentum()}
      </td>
    </tr>
  );
}

export default function MarketTable() {
  const selectedSymbol = useDashboardStore((state) => state.selectedSymbol);
  const supportedSymbols = useDashboardStore((state) => state.supportedSymbols);
  const tickerData = useDashboardStore((state) => state.tickerData);
  const setSymbol = useDashboardStore((state) => state.setSymbol);

  const allIndicators = useMarketStore((state) => state.allIndicators);
  const allAnalytics = useMarketStore((state) => state.allAnalytics);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col h-[350px] shadow-sm">
      <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between shrink-0">
        <h3 className="font-bold text-card-foreground text-sm uppercase tracking-wider">Market Watchlist</h3>
        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest bg-muted px-2 py-0.5 rounded border border-border/50">Binance Spot</span>
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-background/30">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border/50 text-[9px] uppercase font-black text-muted-foreground tracking-widest sticky top-0 bg-background/80 backdrop-blur-sm z-10">
              <th className="px-4 py-2.5">Asset</th>
              <th className="px-4 py-2.5 text-right">Price</th>
              <th className="px-4 py-2.5 text-right">24h %</th>
              <th className="px-4 py-2.5 text-center">State</th>
              <th className="px-4 py-2.5 text-right">RSI</th>
              <th className="px-4 py-2.5 text-right">Momentum</th>
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
                indicators={allIndicators[sym]}
                analytics={allAnalytics[sym]}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
