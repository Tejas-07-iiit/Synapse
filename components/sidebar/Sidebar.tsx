"use client";

import React from "react";
import { 
  LayoutDashboard, 
  TrendingUp, 
  Cpu, 
  Briefcase, 
  Settings,
  LineChart
} from "lucide-react";

export default function Sidebar() {
  return (
    <aside className="w-64 bg-slate-950 text-slate-100 flex flex-col h-full border-r border-slate-900 shrink-0">
      {/* Brand logo */}
      <div className="p-5 border-b border-slate-900 flex items-center gap-2">
        <LineChart className="text-blue-500" size={24} />
        <span className="text-lg font-black tracking-wider text-white">SYNAPSE</span>
        <span className="text-[9px] font-bold bg-blue-900/60 text-blue-300 px-1 py-0.2 rounded uppercase">PRO</span>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 px-4 py-6 space-y-1.5">
        <a
          href="#"
          className="flex items-center gap-3 px-3 py-2 bg-blue-600 text-white rounded font-medium text-sm transition"
        >
          <LayoutDashboard size={18} />
          <span>Trading Workspace</span>
        </a>
        <a
          href="#"
          className="flex items-center gap-3 px-3 py-2 text-slate-400 hover:bg-slate-900 hover:text-white rounded text-sm transition"
        >
          <TrendingUp size={18} />
          <span>Market Overview</span>
        </a>
        <a
          href="#"
          className="flex items-center gap-3 px-3 py-2 text-slate-400 hover:bg-slate-900 hover:text-white rounded text-sm transition"
        >
          <Cpu size={18} />
          <span>AI Trading Signals</span>
        </a>
        <a
          href="#"
          className="flex items-center gap-3 px-3 py-2 text-slate-400 hover:bg-slate-900 hover:text-white rounded text-sm transition"
        >
          <Briefcase size={18} />
          <span>Portfolio Asset</span>
        </a>
        <a
          href="#"
          className="flex items-center gap-3 px-3 py-2 text-slate-400 hover:bg-slate-900 hover:text-white rounded text-sm transition"
        >
          <Settings size={18} />
          <span>Terminal Settings</span>
        </a>
      </nav>

      {/* Connection summary */}
      <div className="p-4 border-t border-slate-900 text-[10px] text-slate-500 flex flex-col gap-1 font-mono">
        <div className="flex items-center justify-between">
          <span>Binance Spot API:</span>
          <span className="text-green-500 font-bold">ONLINE</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Latency:</span>
          <span className="text-slate-400">~24ms</span>
        </div>
      </div>
    </aside>
  );
}
