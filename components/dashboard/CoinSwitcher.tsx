"use client";

import React from "react";
import { useState } from "react";
import { useDashboardStore } from "@/store/dashboard/useDashboardStore";

export default function CoinSwitcher() {
  const selectedSymbol = useDashboardStore((state) => state.selectedSymbol);
  const supportedSymbols = useDashboardStore((state) => state.supportedSymbols);
  const setSymbol = useDashboardStore((state) => state.setSymbol);
  const [open, setOpen] = useState(false);
  const getCleanName = (symbol: string) => {
    return symbol.replace("USDT", "");
  };

  return (
   <div className="relative w-40">
  <button
    onClick={() => setOpen(!open)}
    className="
      w-full flex items-center justify-between
      bg-card border border-primary/50
      rounded-xl px-4 py-2.5
      text-foreground font-bold uppercase tracking-widest text-xs
      shadow-sm
      hover:border-primary transition-all duration-300
      focus:outline-none focus:ring-2 focus:ring-primary/20
    "
  >
    <div className="flex items-center gap-2">
      <span className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(37,99,235,0.4)]"></span>
      {getCleanName(selectedSymbol)}
    </div>

    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={`w-3.5 h-3.5 transition-transform duration-300 ${
        open ? "rotate-180" : ""
      }`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={3}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 9l-7 7-7-7"
      />
    </svg>
  </button>

  {open && (
    <div
      className="
        absolute mt-2 w-full
        bg-card border border-border
        rounded-xl overflow-hidden
        shadow-xl z-50
        animate-in fade-in slide-in-from-top-2
      "
    >
      {supportedSymbols.map((sym) => (
        <button
          key={sym}
          onClick={() => {
            setSymbol(sym);
            setOpen(false);
          }}
          className={`
            w-full text-left px-4 py-2.5 text-xs font-bold uppercase tracking-widest
            transition-all duration-200
            ${
              selectedSymbol === sym
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }
          `}
        >
          {getCleanName(sym)}
        </button>
      ))}
    </div>
  )}
</div>
  );
}
