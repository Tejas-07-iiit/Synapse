"use client";

import React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/useAuthStore";
import { useDashboardStore } from "@/store/dashboard/useDashboardStore";
import CoinSwitcher from "@/components/dashboard/CoinSwitcher";
import { LogOut, User as UserIcon, Link2, Link2Off, RefreshCw } from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export default function Navbar() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const wsStatus = useDashboardStore((state) => state.wsStatus);

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <header className="bg-background border-b border-border px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
      {/* Page Title & Connection status */}
      <div className="flex items-center gap-4">
        <h2 className="text-md font-bold text-foreground uppercase tracking-wider">Spot Trading</h2>
        <div className="h-4 w-[1px] bg-border hidden sm:block"></div>
        <div className="flex items-center gap-2">
          {wsStatus === "CONNECTED" && (
            <span className="flex items-center gap-1.5 text-xs text-green-500 font-bold tracking-tight">
              <Link2 size={14} className="text-green-500" />
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_6px_#22c55e]"></span>
              CONNECTED
            </span>
          )}
          {wsStatus === "RECONNECTING" && (
            <span className="flex items-center gap-1.5 text-xs text-amber-500 font-bold tracking-tight">
              <RefreshCw size={12} className="text-amber-500 animate-spin" />
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shadow-[0_0_6px_#f59e0b]"></span>
              RECONNECTING
            </span>
          )}
          {wsStatus === "DISCONNECTED" && (
            <span className="flex items-center gap-1.5 text-xs text-red-500 font-bold tracking-tight">
              <Link2Off size={14} className="text-red-500" />
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_6px_#ef4444]"></span>
              DISCONNECTED
            </span>
          )}
        </div>
      </div>

      {/* Switcher in middle */}
      <div className="shrink-0">
        <CoinSwitcher />
      </div>

      {/* Profile, Theme Toggle & Logout */}
      <div className="flex items-center gap-3 lg:gap-4 ml-auto">
        {/* Toggle Option Tabs */}
        <div className="flex items-center bg-secondary/50 p-1 rounded-xl border border-border text-[10px] uppercase font-black tracking-wider mr-2">
          <span className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground shadow-sm font-black">
            Crypto
          </span>
          <Link href="/mcx" className="px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-all">
            MCX
          </Link>
        </div>

        <ThemeToggle />
        
        <div className="h-8 w-px bg-border mx-1 hidden lg:block"></div>


        <div className="flex items-center gap-2.5 bg-secondary/50 border border-border px-3 py-2 rounded-xl text-xs font-bold shadow-inner">
          <div className="w-5 h-5 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/20">
            <UserIcon size={12} className="text-primary" />
          </div>
          <span className="text-foreground tracking-tight">
            {user ? user.username : "Guest"}
          </span>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 text-[11px] font-black uppercase tracking-[0.1em] text-white bg-red-400 hover:bg-red-500 rounded-xl transition-all duration-300 shadow-lg shadow-red-600/20 active:scale-95 whitespace-nowrap border border-red-500/20"
        >
          <LogOut size={14} strokeWidth={3} />
          <span className="hidden md:inline">Log Out</span>
        </button>

      </div>
    </header>
  );
}
