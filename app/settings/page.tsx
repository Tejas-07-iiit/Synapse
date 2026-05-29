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
  RotateCcw
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
  const [pingLatency, setPingLatency] = useState<number | null>(null);
  const [lastSync, setLastSync] = useState<string>("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  // Form states mapping directly to settings store
  const [formData, setFormData] = useState({
    autoTrading: false,
    riskPerTradePct: 2.0,
    maxOpenTrades: 3,
    defaultSlPct: 1.5,
    defaultTpPct: 3.0,
    prefTimeframe: "15m",
    prefSymbol: "BTCUSDT",
  });

  // Signal toggles
  const [prefEma, setPrefEma] = useState(true);
  const [prefRsi, setPrefRsi] = useState(true);
  const [prefMacd, setPrefMacd] = useState(true);
  const [prefBb, setPrefBb] = useState(true);
  const [prefCandle, setPrefCandle] = useState(false);

  useEffect(() => {
    setMounted(true);
    setLastSync(new Date().toLocaleTimeString());
    const checkPing = async () => {
      const start = Date.now();
      try {
        await fetch("https://api.binance.com/api/v3/ping");
        setPingLatency(Date.now() - start);
      } catch {
        setPingLatency(null);
      }
    };
    checkPing();
    const interval = setInterval(checkPing, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    } else if (user?.id) {
      settings.fetchSettings(user.id);
      wallet.fetchWallet(user.id);
    }
  }, [isAuthenticated, authLoading, router, user?.id, settings, wallet]);

  useEffect(() => {
    if (!settings.loading && !settings.error) {
      setFormData({
        autoTrading: settings.autoTrading,
        riskPerTradePct: settings.riskPerTradePct,
        maxOpenTrades: settings.maxOpenTrades,
        defaultSlPct: settings.defaultSlPct,
        defaultTpPct: settings.defaultTpPct,
        prefTimeframe: settings.prefTimeframe,
        prefSymbol: settings.prefSymbol,
      });
    }
  }, [settings.autoTrading, settings.riskPerTradePct, settings.maxOpenTrades, settings.defaultSlPct, settings.defaultTpPct, settings.prefTimeframe, settings.prefSymbol, settings.loading, settings.error]);

  // Load UI-only settings from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      setPrefEma(localStorage.getItem("settings_pref_ema") !== "false");
      setPrefRsi(localStorage.getItem("settings_pref_rsi") !== "false");
      setPrefMacd(localStorage.getItem("settings_pref_macd") !== "false");
      setPrefBb(localStorage.getItem("settings_pref_bb") !== "false");
      setPrefCandle(localStorage.getItem("settings_pref_candle") === "true");
    }
  }, []);

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
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    }
    
    if (typeof window !== "undefined") {
      localStorage.setItem("settings_pref_ema", String(prefEma));
      localStorage.setItem("settings_pref_rsi", String(prefRsi));
      localStorage.setItem("settings_pref_macd", String(prefMacd));
      localStorage.setItem("settings_pref_bb", String(prefBb));
      localStorage.setItem("settings_pref_candle", String(prefCandle));
    }
  };

  const handleResetWallet = async () => {
    if (!user?.id) return;
    if (confirm("Are you sure you want to reset your paper wallet back to $10,000? All current balances and PnL metrics will be lost.")) {
      try {
        await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id, resetWallet: true }), // Placeholder API endpoint logic to be handled next
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

  if (authLoading || !mounted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground font-semibold">Loading authentication...</p>
        </div>
      </div>
    );
  }

  return (
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
                Terminal Settings & Health
              </h1>
              <p className="text-xs text-muted-foreground">
                Customize local preferences, display engines, and view API connections health.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveSettings} className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            
            {/* Left/Middle Columns: Settings Forms */}
            <div className="xl:col-span-2 space-y-6">
              
              {/* Section 1: Appearance Themes */}
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
                    Light Theme
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
                    Dark Theme
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
                    System Sync
                  </button>

                </div>
              </div>

              {/* Section 2: Trading Defaults */}
              <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-primary border-b border-border/40 pb-2">
                  <Sliders size={16} />
                  <h3 className="font-black text-xs uppercase tracking-wider text-card-foreground">Workspace defaults config</h3>
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

                  {/* Default Timeframe */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-muted-foreground uppercase">Default Indicators Timeframe</label>
                    <select
                      name="prefTimeframe"
                      value={formData.prefTimeframe}
                      onChange={handleChange}
                      className="w-full p-2.5 bg-secondary/50 border border-border rounded-xl text-foreground font-semibold uppercase focus:outline-none focus:border-primary"
                    >
                      <option value="5m">5 Minute (Scalp)</option>
                      <option value="15m">15 Minute (Intraday)</option>
                    </select>
                  </div>

                  {/* Default Risk */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-muted-foreground uppercase">Target Risk per Trade (%)</label>
                    <input
                      name="riskPerTradePct"
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="10"
                      value={formData.riskPerTradePct}
                      onChange={handleChange}
                      className="w-full p-2.5 bg-secondary/50 border border-border rounded-xl text-foreground font-semibold focus:outline-none focus:border-primary"
                    />
                  </div>

                  {/* Max Open Trades */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-muted-foreground uppercase">Max Open Trades</label>
                    <input
                      name="maxOpenTrades"
                      type="number"
                      step="1"
                      min="1"
                      max="10"
                      value={formData.maxOpenTrades}
                      onChange={handleChange}
                      className="w-full p-2.5 bg-secondary/50 border border-border rounded-xl text-foreground font-semibold focus:outline-none focus:border-primary"
                    />
                  </div>

                  {/* Default SL % */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-muted-foreground uppercase">Default Stop Loss (%)</label>
                    <input
                      name="defaultSlPct"
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="20"
                      value={formData.defaultSlPct}
                      onChange={handleChange}
                      className="w-full p-2.5 bg-secondary/50 border border-border rounded-xl text-foreground font-semibold focus:outline-none focus:border-primary"
                    />
                  </div>

                  {/* Default TP % */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-muted-foreground uppercase">Default Take Profit (%)</label>
                    <input
                      name="defaultTpPct"
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="50"
                      value={formData.defaultTpPct}
                      onChange={handleChange}
                      className="w-full p-2.5 bg-secondary/50 border border-border rounded-xl text-foreground font-semibold focus:outline-none focus:border-primary"
                    />
                  </div>

                  {/* Auto Trading */}
                  <div className="flex items-center justify-between p-2.5 bg-secondary/35 border border-border rounded-xl mt-4 md:col-span-2">
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

              {/* Section 3: Signal Preferences */}
              <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-primary border-b border-border/40 pb-2">
                  <Database size={16} />
                  <h3 className="font-black text-xs uppercase tracking-wider text-card-foreground">Confluence Signal Engines preferences</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  
                  {/* EMA Toggle */}
                  <div className="flex items-center justify-between p-3 bg-secondary/20 border border-border/60 rounded-xl">
                    <div>
                      <span className="font-bold text-foreground block">EMA Exponential Ribbon Crossover</span>
                      <span className="text-[10px] text-muted-foreground">Generates alignment indicators from EMA 12/20/26/50 confluences.</span>
                    </div>
                    <button type="button" onClick={() => setPrefEma(!prefEma)} className="cursor-pointer">
                      {prefEma ? <ToggleRight size={28} className="text-primary" /> : <ToggleLeft size={28} className="text-muted-foreground" />}
                    </button>
                  </div>

                  {/* RSI Toggle */}
                  <div className="flex items-center justify-between p-3 bg-secondary/20 border border-border/60 rounded-xl">
                    <div>
                      <span className="font-bold text-foreground block">RSI Momentum Threshold Index</span>
                      <span className="text-[10px] text-muted-foreground">Triggers oversold/overbought notifications below 30 or above 70.</span>
                    </div>
                    <button type="button" onClick={() => setPrefRsi(!prefRsi)} className="cursor-pointer">
                      {prefRsi ? <ToggleRight size={28} className="text-primary" /> : <ToggleLeft size={28} className="text-muted-foreground" />}
                    </button>
                  </div>

                  {/* MACD Toggle */}
                  <div className="flex items-center justify-between p-3 bg-secondary/20 border border-border/60 rounded-xl">
                    <div>
                      <span className="font-bold text-foreground block">MACD Signal Line Divergences</span>
                      <span className="text-[10px] text-muted-foreground">Monitors MACD histogram and crossover directions.</span>
                    </div>
                    <button type="button" onClick={() => setPrefMacd(!prefMacd)} className="cursor-pointer">
                      {prefMacd ? <ToggleRight size={28} className="text-primary" /> : <ToggleLeft size={28} className="text-muted-foreground" />}
                    </button>
                  </div>

                  {/* Bollinger Toggle */}
                  <div className="flex items-center justify-between p-3 bg-secondary/20 border border-border/60 rounded-xl">
                    <div>
                      <span className="font-bold text-foreground block">Bollinger Bands Breakout Scanner</span>
                      <span className="text-[10px] text-muted-foreground">Monitors upper/lower bounds envelope breakouts.</span>
                    </div>
                    <button type="button" onClick={() => setPrefBb(!prefBb)} className="cursor-pointer">
                      {prefBb ? <ToggleRight size={28} className="text-primary" /> : <ToggleLeft size={28} className="text-muted-foreground" />}
                    </button>
                  </div>

                  {/* Candlestick Toggle */}
                  <div className="flex items-center justify-between p-3 bg-secondary/20 border border-border/60 rounded-xl md:col-span-2">
                    <div>
                      <span className="font-bold text-foreground block">AI Candlestick Pattern Recognition Engine</span>
                      <span className="text-[10px] text-muted-foreground">Highlights Doji, Hammer, and Engulfing candlestick patterns automatically.</span>
                    </div>
                    <button type="button" onClick={() => setPrefCandle(!prefCandle)} className="cursor-pointer">
                      {prefCandle ? <ToggleRight size={28} className="text-primary" /> : <ToggleLeft size={28} className="text-muted-foreground" />}
                    </button>
                  </div>

                </div>
              </div>

              {/* Action Bar */}
              <div className="flex justify-end gap-3">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-primary hover:bg-primary/95 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition shadow flex items-center gap-1.5 cursor-pointer"
                >
                  {saveSuccess ? <Check size={14} /> : null}
                  {saveSuccess ? "Preferences Saved" : "Save Preferences"}
                </button>
              </div>

            </div>

            {/* Right Column: User Profile & API status */}
            <div className="space-y-6">
              
              {/* Section 4: Account Details */}
              <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col space-y-4">
                <div className="flex items-center gap-2 text-primary border-b border-border/40 pb-2">
                  <UserIcon size={16} />
                  <h3 className="font-black text-xs uppercase tracking-wider text-card-foreground">Secure Profile details</h3>
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

              {/* Section 5: System Status Health */}
              <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col space-y-4">
                <div className="flex items-center gap-2 text-primary border-b border-border/40 pb-2">
                  <Wifi size={16} />
                  <h3 className="font-black text-xs uppercase tracking-wider text-card-foreground">System Health Monitor</h3>
                </div>

                <div className="space-y-4 text-xs">
                  {/* Websocket Connection */}
                  <div className="flex justify-between items-center border-b border-border/20 py-1.5">
                    <span className="text-muted-foreground font-semibold">Websocket Gateway</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black border uppercase ${
                      wsStatus === "CONNECTED"
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                        : wsStatus === "RECONNECTING"
                        ? "bg-amber-500/10 border-amber-500/20 text-amber-500 animate-pulse"
                        : "bg-destructive/10 border-destructive/20 text-destructive"
                    }`}>
                      {wsStatus}
                    </span>
                  </div>

                  {/* API Latency */}
                  <div className="flex justify-between items-center border-b border-border/20 py-1.5">
                    <span className="text-muted-foreground font-semibold">Binance API Latency</span>
                    <span className="font-bold text-foreground">
                      {pingLatency !== null ? `${pingLatency}ms` : "checking..."}
                    </span>
                  </div>

                  {/* Active Websocket Streams */}
                  <div className="flex justify-between items-center border-b border-border/20 py-1.5">
                    <span className="text-muted-foreground font-semibold">Active Watchlist Streams</span>
                    <span className="font-bold text-foreground">
                      {supportedSymbols.length > 0 ? `${supportedSymbols.length} Tickers` : "3 Tickers"}
                    </span>
                  </div>

                  {/* Last Sync Timestamp */}
                  <div className="flex justify-between items-center border-b border-border/20 py-1.5">
                    <span className="text-muted-foreground font-semibold">Last State Sync</span>
                    <span className="font-bold text-muted-foreground">{lastSync}</span>
                  </div>

                  <div className="flex gap-2.5 items-start text-[10px] text-muted-foreground leading-relaxed bg-secondary/15 border border-border/20 px-3 py-2 rounded-lg">
                    <ShieldAlert size={14} className="text-primary mt-0.5 shrink-0" />
                    <span>
                      Algorithmic state runs are logged locally to audit logs. Client connection streams require persistent WebSocket gateway connection.
                    </span>
                  </div>

                </div>
              </div>

            </div>

          </form>

        </main>
      </div>
    </div>
  );
}
