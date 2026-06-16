"use client";

import React, { useEffect, useState } from "react";
import { 
  LayoutDashboard, 
  TrendingUp, 
  Wallet, 
  Settings,
  Flame
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMcxStore } from "@/store/useMcxStore";

export default function McxSidebar() {
  const pathname = usePathname();
  const { isTradingLive, setIsTradingLive } = useMcxStore();
  const [istTimeStr, setIstTimeStr] = useState("");

  const checkMcxStatus = () => {
    try {
      const now = new Date();
      const istStr = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
      const istDate = new Date(istStr);
      
      const day = istDate.getDay();
      const hour = istDate.getHours();
      const minute = istDate.getMinutes();

      const pad = (n: number) => String(n).padStart(2, "0");
      setIstTimeStr(`${pad(hour)}:${pad(minute)} IST`);

      const isWeekday = day >= 1 && day <= 5;
      const minutesSinceMidnight = hour * 60 + minute;
      const startMinutes = 9 * 60; // 9:00 AM
      const endMinutes = 23 * 60 + 55; // 11:55 PM

      const isOpen = isWeekday && minutesSinceMidnight >= startMinutes && minutesSinceMidnight <= endMinutes;
      setIsTradingLive(isOpen);
    } catch (e) {
      console.warn("Failed checking IST timezone", e);
    }
  };

  useEffect(() => {
    checkMcxStatus();
    const interval = setInterval(checkMcxStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    {
      href: "/mcx",
      label: "Trading Workspace",
      icon: LayoutDashboard,
    },
    {
      href: "/mcx/trade-history",
      label: "Trade History",
      icon: TrendingUp,
    },
    {
      href: "/mcx/money",
      label: "Portfolio Asset",
      icon: Wallet,
    },
    {
      href: "/mcx/settings",
      label: "Terminal Settings",
      icon: Settings,
    },
  ];

  return (
    <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col h-full border-r border-sidebar-border shrink-0 z-30">
      {/* Brand logo */}
      <div className="p-5 border-b border-sidebar-border flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
          <Flame className="text-primary-foreground" size={20} />
        </div>
        <span className="text-lg font-black tracking-wider text-foreground">SYNAPSE</span>
        <span className="text-[9px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded uppercase border border-primary/20">MCX</span>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 px-4 py-6 space-y-1.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition duration-200 group ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20 font-semibold"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              <Icon 
                size={18} 
                className={isActive ? "" : "group-hover:text-primary transition-colors"} 
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Market Status</span>
          <span className={`font-bold ${isTradingLive ? "text-green-500" : "text-red-500"}`}>
            {isTradingLive ? "OPEN" : "CLOSED"}
          </span>
        </div>
        <div className="mt-1 text-[10px] text-muted-foreground text-right font-mono">
          {istTimeStr}
        </div>
      </div>
    </aside>
  );
}
