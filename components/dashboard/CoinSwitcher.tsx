"use client";

import React from "react";
import { useDashboardStore } from "@/store/dashboard/useDashboardStore";

export default function CoinSwitcher() {
  const selectedSymbol = useDashboardStore((state) => state.selectedSymbol);
  const supportedSymbols = useDashboardStore((state) => state.supportedSymbols);
  const setSymbol = useDashboardStore((state) => state.setSymbol);

  const getCleanName = (symbol: string) => {
    return symbol.replace("USDT", "");
  };

  return (
    <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1 rounded text-sm shrink-0">
      {supportedSymbols.map((sym) => (
        <button
          key={sym}
          onClick={() => setSymbol(sym)}
          className={`px-3 py-1.5 rounded font-semibold transition text-xs sm:text-sm ${
            selectedSymbol === sym
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-400 hover:text-slate-100 hover:bg-slate-800"
          }`}
        >
          {getCleanName(sym)}
        </button>
      ))}
    </div>
  );
}
