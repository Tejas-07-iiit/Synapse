"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { useDashboardStore } from "@/store/dashboard/useDashboardStore";
import CoinSwitcher from "@/components/dashboard/CoinSwitcher";
import { LogOut, User as UserIcon, Link2, Link2Off } from "lucide-react";

export default function Navbar() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const wsConnected = useDashboardStore((state) => state.wsConnected);

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <header className="bg-slate-950 border-b border-slate-900 px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
      {/* Page Title & Connection status */}
      <div className="flex items-center gap-4">
        <h2 className="text-md font-bold text-white uppercase tracking-wider">Spot Trading</h2>
        <div className="h-4 w-[1px] bg-slate-800 hidden sm:block"></div>
        <div className="flex items-center gap-2">
          {wsConnected ? (
            <span className="flex items-center gap-1.5 text-xs text-green-500 font-medium">
              <Link2 size={14} className="text-green-500" />
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
              Live Feed
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-red-500 font-medium">
              <Link2Off size={14} className="text-red-500" />
              <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
              Disconnected
            </span>
          )}
        </div>
      </div>

      {/* Switcher in middle */}
      <div className="shrink-0">
        <CoinSwitcher />
      </div>

      {/* Profile & Logout */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded text-xs">
          <UserIcon size={14} className="text-blue-400" />
          <span className="font-semibold text-slate-200">
            {user ? user.username : "Guest"}
          </span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-slate-900 hover:text-red-300 rounded border border-transparent hover:border-red-900/40 transition font-semibold"
        >
          <LogOut size={14} />
          <span className="hidden md:inline">Log out</span>
        </button>
      </div>
    </header>
  );
}
