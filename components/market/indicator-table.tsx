"use client";

import React from "react";
import { IndicatorValues, TickerInfo } from "@/types/market";
import { RefreshCw } from "lucide-react";

interface IndicatorTableProps {
  indicators: IndicatorValues | undefined;
  ticker: TickerInfo | undefined;
}

export default function IndicatorTable({ indicators, ticker }: IndicatorTableProps) {
  if (!indicators) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
        <RefreshCw size={16} className="animate-spin" />
        <span>Loading indicator datasets...</span>
      </div>
    );
  }

  const getLatest = (arr: number[] | undefined) => {
    if (!arr || arr.length === 0) return undefined;
    const val = arr[arr.length - 1];
    return val !== undefined && !isNaN(val) ? val : undefined;
  };

  const currentPrice = ticker?.price ?? 0;

  // Extract latest values
  const ema20 = getLatest(indicators.ema20);
  const sma50 = getLatest(indicators.sma50);
  const rsi = getLatest(indicators.rsi);
  const macdLine = getLatest(indicators.macdLine);
  const signalLine = getLatest(indicators.signalLine);
  const macdHist = getLatest(indicators.macdHist);
  const bbUpper = getLatest(indicators.bbUpper);
  const bbMiddle = getLatest(indicators.bbMiddle);
  const bbLower = getLatest(indicators.bbLower);
  const atr = getLatest(indicators.atr);
  const vwap = getLatest(indicators.vwap);
  const volumeMA = getLatest(indicators.volumeMA);

  // Formatting helpers
  const fmt = (val: number | undefined, dec = 2) => {
    if (val === undefined) return "—";
    return val.toLocaleString(undefined, {
      minimumFractionDigits: dec,
      maximumFractionDigits: dec,
    });
  };

  const getRsiState = (val: number | undefined) => {
    if (val === undefined) return { label: "Neutral", class: "text-muted-foreground" };
    if (val >= 70) return { label: "Overbought", class: "text-orange-400 font-bold" };
    if (val <= 30) return { label: "Oversold", class: "text-purple-400 font-bold" };
    return { label: "Neutral", class: "text-foreground/80" };
  };

  const getMacdState = (hist: number | undefined) => {
    if (hist === undefined) return { label: "Neutral", class: "text-muted-foreground" };
    if (hist > 0) return { label: "Bullish Momentum", class: "text-green-400 font-semibold" };
    return { label: "Bearish Momentum", class: "text-red-400 font-semibold" };
  };

  const rsiState = getRsiState(rsi);
  const macdState = getMacdState(macdHist);

  const indicatorRows = [
    {
      name: "Exponential Moving Average (EMA 20)",
      value: fmt(ema20),
      state: currentPrice > (ema20 ?? 0) ? "Price Above (Bullish)" : "Price Below (Bearish)",
      stateClass: currentPrice > (ema20 ?? 0) ? "text-green-400 font-medium" : "text-red-400 font-medium",
      category: "Trend",
    },
    {
      name: "Simple Moving Average (SMA 50)",
      value: fmt(sma50),
      state: currentPrice > (sma50 ?? 0) ? "Price Above (Bullish)" : "Price Below (Bearish)",
      stateClass: currentPrice > (sma50 ?? 0) ? "text-green-400 font-medium" : "text-red-400 font-medium",
      category: "Trend",
    },
    {
      name: "Relative Strength Index (RSI 14)",
      value: fmt(rsi, 1),
      state: rsiState.label,
      stateClass: rsiState.class,
      category: "Momentum",
    },
    {
      name: "MACD Line",
      value: fmt(macdLine, 3),
      state: `Signal: ${fmt(signalLine, 3)}`,
      stateClass: "text-muted-foreground",
      category: "Momentum",
    },
    {
      name: "MACD Histogram",
      value: fmt(macdHist, 3),
      state: macdState.label,
      stateClass: macdState.class,
      category: "Momentum",
    },
    {
      name: "Bollinger Bands Upper",
      value: fmt(bbUpper),
      state: currentPrice > (bbUpper ?? 0) ? "Price Above Upper (Overextended)" : "Below Upper Band",
      stateClass: currentPrice > (bbUpper ?? 0) ? "text-orange-400" : "text-muted-foreground",
      category: "Volatility",
    },
    {
      name: "Bollinger Bands Basis (Middle SMA 20)",
      value: fmt(bbMiddle),
      state: "Channel standard deviation baseline",
      stateClass: "text-muted-foreground text-[11px]",
      category: "Volatility",
    },
    {
      name: "Bollinger Bands Lower",
      value: fmt(bbLower),
      state: currentPrice < (bbLower ?? 0) ? "Price Below Lower (Overextended)" : "Above Lower Band",
      stateClass: currentPrice < (bbLower ?? 0) ? "text-purple-400" : "text-muted-foreground",
      category: "Volatility",
    },
    {
      name: "Average True Range (ATR 14)",
      value: fmt(atr),
      state: "Measuring price volatility spread",
      stateClass: "text-muted-foreground text-[11px]",
      category: "Volatility",
    },
    {
      name: "Volume Weighted Average Price (VWAP)",
      value: fmt(vwap),
      state: currentPrice > (vwap ?? 0) ? "Bullish Premium" : "Bearish Discount",
      stateClass: currentPrice > (vwap ?? 0) ? "text-green-400" : "text-red-400",
      category: "Volume / Price",
    },
    {
      name: "Volume Moving Average (Volume MA 20)",
      value: fmt(volumeMA, 0),
      state: "Standard trading volume threshold",
      stateClass: "text-muted-foreground text-[11px]",
      category: "Volume / Price",
    },
  ];

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all">
      <div className="px-6 py-4 border-b border-border bg-muted/20 flex items-center justify-between">
        <h3 className="font-bold text-card-foreground text-sm uppercase tracking-wider">Indicator Breakdown</h3>
        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest bg-muted px-2 py-0.5 rounded border border-border/50">Technical Engine</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border/50 text-[9px] uppercase font-black text-muted-foreground tracking-widest bg-background/50">
              <th className="px-6 py-3">Category</th>
              <th className="px-6 py-3">Technical Indicator</th>
              <th className="px-6 py-3 text-right">Latest Value</th>
              <th className="px-6 py-3 text-right">Status / Signal</th>
            </tr>
          </thead>
          <tbody>
            {indicatorRows.map((row, idx) => (
              <tr key={idx} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                <td className="px-6 py-4 text-xs font-bold text-primary uppercase tracking-wider">
                  {row.category}
                </td>
                <td className="px-6 py-4 text-sm font-semibold text-foreground/90">
                  {row.name}
                </td>
                <td className="px-6 py-4 text-sm font-mono text-right font-bold text-foreground">
                  {row.value}
                </td>
                <td className={`px-6 py-4 text-sm text-right font-mono ${row.stateClass}`}>
                  {row.state}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
