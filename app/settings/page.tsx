"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { useMarketStore } from "@/src/stores/marketStore";
import { useTheme } from "next-themes";
import { useSettingsStore } from "@/src/stores/settingsStore";
import { useWalletStore } from "@/src/stores/walletStore";
import Sidebar from "@/components/sidebar/Sidebar";
import Navbar from "@/components/navbar/Navbar";
import TradingLoader from "@/components/TradingLoader";
import { 
  Settings, 
  Moon, 
  Sun, 
  Laptop, 
  Sliders, 
  ToggleLeft, 
  ToggleRight, 
  User as UserIcon, 
  ShieldAlert, 
  Database,
  Wifi,
  Key,
  LogOut,
  Check,
  RotateCcw,
  AlertCircle
} from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const { user, logout, isAuthenticated, isLoading: authLoading } = useAuthStore();
  const { theme, setTheme } = useTheme();
  
  // Market store variables
  const wsStatus = useMarketStore((state) => state.wsStatus);
  const supportedSymbols = useMarketStore((state) => state.supportedSymbols);

  // Settings & Wallet
  const settings = useSettingsStore();
  const wallet = useWalletStore();

  // States
  const [mounted, setMounted] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  // Form states mapping directly to settings store (prefTimeframe removed)
  const [formData, setFormData] = useState({
    autoTrading: false,
    maxOpenTrades: 3,
    prefSymbol: "BTCUSDT",
    preferredTradingMode: "INTRADAY" as "SCALPING" | "INTRADAY",
    riskPerTradePct: 2.0,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    } else if (user?.id) {
      settings.fetchSettings(user.id);
      wallet.fetchWallet(user.id);
    }
  }, [isAuthenticated, authLoading, router, user?.id, settings.fetchSettings, wallet.fetchWallet]);

  useEffect(() => {
    if (!settings.loading && !settings.error) {
      setFormData({
        autoTrading: settings.autoTrading,
        maxOpenTrades: settings.maxOpenTrades,
        prefSymbol: settings.prefSymbol,
        preferredTradingMode: settings.preferredTradingMode || "INTRADAY",
        riskPerTradePct: settings.riskPerTradePct || 2.0,
      });
    }
  }, [settings.autoTrading, settings.maxOpenTrades, settings.prefSymbol, settings.preferredTradingMode, settings.riskPerTradePct, settings.loading, settings.error]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (type === "number") {
      setFormData(prev => ({ ...prev, [name]: parseFloat(value) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user?.id) {
      await settings.updateSettings(user.id, formData);
      if (!useSettingsStore.getState().error) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      }
    }
  };

  const handleResetWallet = async () => {
    if (!user?.id) return;
    if (confirm("Are you sure you want to reset your paper wallet back to $10,000? All current balances and PnL metrics will be lost.")) {
      try {
        await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id, resetWallet: true }),
        });
        await wallet.fetchWallet(user.id);
        setResetSuccess(true);
        setTimeout(() => setResetSuccess(false), 2000);
      } catch (err) {
        console.error("Failed to reset wallet:", err);
      }
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <>
      <TradingLoader loading={authLoading || !mounted} />
      <div className="flex h-screen w-screen bg-background text-foreground overflow-hidden font-sans transition-colors duration-300">
        {/* Sidebar Navigation */}
        <Sidebar />

      {/* Main Panel Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-background/95">
        {/* Top Navbar */}
        <Navbar />

        {/* Settings Workspace Body */}
        <main className="flex-1 px-8 py-6 pb-16 space-y-6 min-h-0">
          
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-4">
            <div>
              <h1 className="text-xl font-black tracking-tight text-foreground uppercase flex items-center gap-2">
                <Settings className="text-primary animate-pulse" size={22} />
                Terminal Settings
              </h1>
              <p className="text-xs text-muted-foreground">
                Customize local preferences, risk settings, and manage your account.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveSettings} className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            
            {/* Left/Middle Columns: Workspace Settings */}
            <div className="xl:col-span-2 space-y-6">
              
              {/* Workspace defaults config */}
              <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-primary border-b border-border/40 pb-2">
                  <Sliders size={16} />
                  <h3 className="font-black text-xs uppercase tracking-wider text-card-foreground">Workspace Defaults</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  
                  {/* Default Coin Select */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-muted-foreground uppercase">Default Workspace Asset</label>
                    <select
                      name="prefSymbol"
                      value={formData.prefSymbol}
                      onChange={handleChange}
                      className="w-full p-2.5 bg-secondary/50 border border-border rounded-xl text-foreground font-semibold uppercase focus:outline-none focus:border-primary"
                    >
                      <option value="BTCUSDT">BTCUSDT (Bitcoin)</option>
                      <option value="ETHUSDT">ETHUSDT (Ethereum)</option>
                      <option value="SOLUSDT">SOLUSDT (Solana)</option>
                    </select>
                  </div>

                  {/* Preferred Trading Mode Select */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-muted-foreground uppercase">Preferred Trading Mode</label>
                    <select
                      name="preferredTradingMode"
                      value={formData.preferredTradingMode}
                      onChange={handleChange}
                      className="w-full p-2.5 bg-secondary/50 border border-border rounded-xl text-foreground font-semibold focus:outline-none focus:border-primary"
                    >
                      <option value="SCALPING">SCALPING (Fast 5m setups)</option>
                      <option value="INTRADAY">INTRADAY (Standard 15m+ setups)</option>
                    </select>
                  </div>

                  {/* Auto Trading Toggle */}
                  <div className="flex items-center justify-between p-2.5 bg-secondary/35 border border-border rounded-xl md:col-span-2">
                    <div>
                      <span className="font-bold text-foreground block">Autonomous Paper Trading</span>
                      <span className="text-[10px] text-muted-foreground">Allows the strategy engine to automatically open/close positions.</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        name="autoTrading"
                        className="sr-only peer" 
                        checked={formData.autoTrading}
                        onChange={handleChange}
                      />
                      <div className="w-11 h-6 bg-secondary peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>

                </div>
              </div>

              {/* Action Bar */}
              <div className="flex justify-end gap-3 items-center">
                {settings.error && (
                  <span className="text-xs font-bold text-destructive flex items-center gap-1.5 bg-destructive/10 px-3 py-1.5 rounded-lg border border-destructive/20">
                    <AlertCircle size={14} />
                    {settings.error}
                  </span>
                )}
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-primary hover:bg-primary/95 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition shadow flex items-center gap-1.5 cursor-pointer"
                >
                  {saveSuccess ? <Check size={14} /> : null}
                  {saveSuccess ? "Preferences Saved" : "Save Preferences"}
                </button>
              </div>

            </div>

            {/* Right Column: Theme & Account Details */}
            <div className="space-y-6">
              
              {/* Terminal Theme Appearance */}
              <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-primary border-b border-border/40 pb-2">
                  <Sun size={16} />
                  <h3 className="font-black text-xs uppercase tracking-wider text-card-foreground">Terminal Theme Appearance</h3>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {/* Light Button */}
                  <button
                    type="button"
                    onClick={() => setTheme("light")}
                    className={`flex flex-col items-center gap-2.5 p-4 rounded-xl border text-xs font-black uppercase transition duration-200 cursor-pointer ${
                      theme === "light"
                        ? "bg-primary/10 border-primary text-primary"
                        : "bg-secondary/40 border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Sun size={18} />
                    Light
                  </button>

                  {/* Dark Button */}
                  <button
                    type="button"
                    onClick={() => setTheme("dark")}
                    className={`flex flex-col items-center gap-2.5 p-4 rounded-xl border text-xs font-black uppercase transition duration-200 cursor-pointer ${
                      theme === "dark"
                        ? "bg-primary/10 border-primary text-primary"
                        : "bg-secondary/40 border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Moon size={18} />
                    Dark
                  </button>

                  {/* System Button */}
                  <button
                    type="button"
                    onClick={() => setTheme("system")}
                    className={`flex flex-col items-center gap-2.5 p-4 rounded-xl border text-xs font-black uppercase transition duration-200 cursor-pointer ${
                      theme === "system"
                        ? "bg-primary/10 border-primary text-primary"
                        : "bg-secondary/40 border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Laptop size={18} />
                    System
                  </button>
                </div>
              </div>

              {/* Secure Profile details (Account settings) */}
              <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col space-y-4">
                <div className="flex items-center gap-2 text-primary border-b border-border/40 pb-2">
                  <UserIcon size={16} />
                  <h3 className="font-black text-xs uppercase tracking-wider text-card-foreground">Account Settings</h3>
                </div>

                {user && (
                  <div className="space-y-4 text-xs">
                    <div>
                      <span className="text-[10px] font-black text-muted-foreground uppercase block">Username</span>
                      <span className="font-extrabold text-sm text-foreground">{user.username}</span>
                    </div>
                    
                    <div>
                      <span className="text-[10px] font-black text-muted-foreground uppercase block">Registered Email</span>
                      <span className="font-semibold text-foreground">{user.email}</span>
                    </div>

                    <div>
                      <span className="text-[10px] font-black text-muted-foreground uppercase block">Verification Status</span>
                      <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-black uppercase">
                        Paper Authenticated
                      </span>
                    </div>

                    <div className="pt-2 flex flex-col gap-2.5">
                      <button
                        type="button"
                        onClick={() => alert("Password management is locked on demo terminal setups.")}
                        className="w-full py-2 bg-secondary/80 hover:bg-secondary border border-border rounded-xl font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground text-[10px] transition duration-200 cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Key size={12} />
                        Update Password
                      </button>

                      <button
                        type="button"
                        onClick={handleResetWallet}
                        className="w-full py-2 bg-yellow-500/10 hover:bg-yellow-600/20 border border-yellow-500/20 text-yellow-600 rounded-xl font-bold uppercase tracking-wider text-[10px] transition duration-200 cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <RotateCcw size={12} />
                        {resetSuccess ? "Wallet Reset Successful!" : "Reset Paper Wallet ($10k)"}
                      </button>

                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full py-2 bg-destructive/10 hover:bg-destructive text-destructive hover:text-white border border-destructive/20 rounded-xl font-extrabold uppercase tracking-wider text-[10px] transition duration-200 cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <LogOut size={12} />
                        Terminate Session
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>

          </form>

        </main>
      </div>
    </div>
    </>
  );
}
