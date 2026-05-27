"use client";

import React from "react";
import { 
  LayoutDashboard, 
  TrendingUp, 
  Cpu, 
  Briefcase, 
  Settings,
  LineChart,
  Brain
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    {
      href: "/dashboard",
      label: "Trading Workspace",
      icon: LayoutDashboard,
    },
    {
      href: "/market-intelligence",
      label: "Market Intelligence",
      icon: Brain,
    },
    {
      href: "/trade-history",
      label: "Trade History",
      icon: TrendingUp,
    },
    {
      href: "/portfolio",
      label: "Portfolio Asset",
      icon: Briefcase,
    },
    {
      href: "/settings",
      label: "Terminal Settings",
      icon: Settings,
    },
  ];

  return (
    <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col h-full border-r border-sidebar-border shrink-0">
      {/* Brand logo */}
      <div className="p-5 border-b border-sidebar-border flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
          <LineChart className="text-primary-foreground" size={20} />
        </div>
        <span className="text-lg font-black tracking-wider text-foreground">SYNAPSE</span>
        <span className="text-[9px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded uppercase border border-primary/20">PRO</span>
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
    </aside>
  );
}
