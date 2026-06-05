"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMcxStore } from "@/store/useMcxStore";
import { useMcxAuthStore } from "@/store/useMcxAuthStore";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { motion, AnimatePresence } from "framer-motion";

import { 
  ChevronDown, 
  User as UserIcon, 
  LogOut, 
  Coins,
  Link2,
  RefreshCw
} from "lucide-react";

const COMMODITIES = [
  { symbol: "GOLD", name: "Gold Standard" },
  { symbol: "SILVER", name: "Silver Standard" },
  { symbol: "CRUDEOIL", name: "Crude Oil Futures" },
  { symbol: "NATURALGAS", name: "Natural Gas" },
  { symbol: "COPPER", name: "Copper Cathodes" }
];

export default function McxTopbar() {
  const router = useRouter();
  const { user, logout } = useMcxAuthStore();
  const { selectedCommodity, setSelectedCommodity, livePrice } = useMcxStore();
  
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    router.push("/mcx/login");
  };

  const formatRupee = (value: number) => {
    if (!value || isNaN(value)) return "₹0.00";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(value);
  };

  return (
    <header className="bg-background border-b border-border px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0 z-20 sticky top-0">
      {/* Page Title & Connection status */}
      <div className="flex items-center gap-4">
        <h2 className="text-md font-bold text-foreground uppercase tracking-wider">Commodity Trading</h2>
        <div className="h-4 w-[1px] bg-border hidden sm:block"></div>
        <div className="flex items-center gap-2">
          {/* Always assume connected for MCX API right now based on polling, or use similar logic */}
          <span className="flex items-center gap-1.5 text-xs text-green-500 font-bold tracking-tight">
            <Link2 size={14} className="text-green-500" />
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_6px_#22c55e]"></span>
            CONNECTED
          </span>
        </div>
      </div>

      {/* Switcher in middle */}
      <div className="shrink-0 relative" ref={dropdownRef}>
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center justify-between gap-3 px-4 py-2 bg-secondary/50 hover:bg-secondary border border-border rounded-xl text-sm font-bold transition-all min-w-[220px]"
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
              <Coins className="text-primary h-3.5 w-3.5" />
            </div>
            <div className="flex flex-col items-start">
              <span className="text-foreground leading-none">{selectedCommodity}</span>
              <span className="text-[10px] text-muted-foreground leading-none mt-0.5">{formatRupee(livePrice)}</span>
            </div>
          </div>
          <ChevronDown className={`text-muted-foreground h-4 w-4 transition-transform duration-300 ${dropdownOpen ? "rotate-180" : ""}`} />
        </motion.button>

        <AnimatePresence>
          {dropdownOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}
              className="absolute left-0 mt-2 w-full bg-popover border border-border rounded-xl shadow-xl z-50 overflow-hidden"
            >
              <div className="py-1">
                {COMMODITIES.map((c) => (
                  <button
                    key={c.symbol}
                    onClick={() => {
                      setSelectedCommodity(c.symbol);
                      setDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between hover:bg-accent transition-colors ${
                      selectedCommodity === c.symbol ? "bg-primary/10 text-primary font-semibold" : "text-foreground"
                    }`}
                  >
                    <span>{c.name}</span>
                    <span className="text-xs font-mono text-muted-foreground">{c.symbol}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Profile, Theme Toggle & Logout */}
      <div className="flex items-center gap-3 lg:gap-4 ml-auto">
        {/* Toggle Option Tabs */}
        <div className="flex items-center bg-secondary/50 p-1 rounded-xl border border-border text-[10px] uppercase font-black tracking-wider mr-2">
          <Link href="/dashboard" className="px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-all">
            Crypto
          </Link>
          <span className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground shadow-sm font-black">
            MCX
          </span>
        </div>

        <ThemeToggle />
        
        <div className="h-8 w-px bg-border mx-1 hidden lg:block"></div>

        <div className="flex items-center gap-2.5 bg-secondary/50 border border-border px-3 py-2 rounded-xl text-xs font-bold shadow-inner">
          <div className="w-5 h-5 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/20">
            <UserIcon size={12} className="text-primary" />
          </div>
          <span className="text-foreground tracking-tight">
            {user ? user.firstName : "Guest"}
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
