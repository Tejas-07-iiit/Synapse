"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMcxAuthStore } from "@/store/useMcxAuthStore";
import { useMcxStore } from "@/store/useMcxStore";
import { 
  Settings, 
  Save, 
  RefreshCw, 
  Sliders, 
  ShieldCheck, 
  Bell, 
  SlidersHorizontal,
  Play,
  Square,
  Cpu
} from "lucide-react";
import MCXLoader from "@/components/mcx/MCXLoader";

interface UserSettingsData {
  defaultLots: number;
  maxLotsPerTrade: number;
  allowLongTrades: boolean;
  allowShortTrades: boolean;
  aiTradingEnabled: boolean;
  maxOpenPositions: number;
  maxMarginUsagePercent: number;
  dailyLossLimitPercent: number;
  autoCompound: boolean;
  selectedCommodities: string[];
  notifications: {
    email: boolean;
    tradeExecuted: boolean;
    tradeClosed: boolean;
    lowBalance: boolean;
    dailySummary: boolean;
  };
}

export default function McxSettingsPage() {
  const { user } = useMcxAuthStore();
  const { engineEnabled, setEngineEnabled } = useMcxStore();
  const [settings, setSettings] = useState<UserSettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [loadingEngineAction, setLoadingEngineAction] = useState(false);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/mcx/user-settings");
      const data = await res.json();
      if (data && data.success && data.data) {
        setSettings(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch settings:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEngineState = async () => {
    try {
      const res = await fetch("/api/mcx/engine/state");
      const data = await res.json();
      if (data && data.success) {
        setEngineEnabled(data.engineEnabled);
      }
    } catch (err) {
      console.warn("Failed to fetch engine state:", err);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchEngineState();
  }, []);

  const handleToggleEngine = async () => {
    setLoadingEngineAction(true);
    const endpoint = engineEnabled ? "/api/mcx/engine/disable" : "/api/mcx/engine/enable";
    try {
      const res = await fetch(endpoint, { method: "POST" });
      const data = await res.json();
      if (data && data.success) {
        setEngineEnabled(!engineEnabled);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingEngineAction(false);
    }
  };

  const handleInputChange = (field: keyof UserSettingsData, value: any) => {
    if (!settings) return;
    setSettings({
      ...settings,
      [field]: value
    });
  };

  const handleNotificationChange = (field: keyof UserSettingsData["notifications"], value: boolean) => {
    if (!settings) return;
    setSettings({
      ...settings,
      notifications: {
        ...settings.notifications,
        [field]: value
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    
    setSaving(true);
    setSaveSuccess(false);

    try {
      const res = await fetch("/api/mcx/user-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (data && data.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Failed to save settings:", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <MCXLoader message="Hydrating account settings..." />;
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight text-foreground">
            Terminal Settings
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure risk parameters, default lots, and execution models.
          </p>
        </div>
        <button
          onClick={fetchSettings}
          className="p-2.5 bg-muted/40 hover:bg-muted/80 border border-border rounded-xl transition-all"
        >
          <RefreshCw size={15} className="text-primary" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Card 1: Trading Configuration */}
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-2 pb-2 border-b border-border/60">
              <Sliders className="text-primary h-5 w-5" />
              <h2 className="text-sm font-black uppercase tracking-wider text-foreground">
                Lot & Quantities
              </h2>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-xs font-black uppercase tracking-wider text-muted-foreground">
                  Default lot Size
                </label>
                <input
                  type="number"
                  value={settings?.defaultLots ?? ""}
                  onChange={(e) => handleInputChange("defaultLots", Number(e.target.value))}
                  className="w-full px-4 py-3 bg-muted/20 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-orange-500 text-foreground font-mono"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-black uppercase tracking-wider text-muted-foreground">
                  Max Lots Per Position
                </label>
                <input
                  type="number"
                  value={settings?.maxLotsPerTrade ?? ""}
                  onChange={(e) => handleInputChange("maxLotsPerTrade", Number(e.target.value))}
                  className="w-full px-4 py-3 bg-muted/20 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-orange-500 text-foreground font-mono"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Risk Management */}
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-2 pb-2 border-b border-border/60">
              <ShieldCheck className="text-primary h-5 w-5" />
              <h2 className="text-sm font-black uppercase tracking-wider text-foreground">
                Risk Management
              </h2>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-xs font-black uppercase tracking-wider text-muted-foreground">
                  Max Margin Usage (%)
                </label>
                <input
                  type="number"
                  value={settings?.maxMarginUsagePercent ?? ""}
                  onChange={(e) => handleInputChange("maxMarginUsagePercent", Number(e.target.value))}
                  className="w-full px-4 py-3 bg-muted/20 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-orange-500 text-foreground font-mono"
                />
              </div>

              {/* Toggles */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between text-xs font-bold text-foreground">
                  <span className="uppercase text-muted-foreground">Allow Long Trades</span>
                  <input
                    type="checkbox"
                    checked={!!settings?.allowLongTrades}
                    onChange={(e) => handleInputChange("allowLongTrades", e.target.checked)}
                    className="w-4 h-4 text-primary border-border rounded focus:ring-primary"
                  />
                </div>

                <div className="flex items-center justify-between text-xs font-bold text-foreground">
                  <span className="uppercase text-muted-foreground">Allow Short Trades</span>
                  <input
                    type="checkbox"
                    checked={!!settings?.allowShortTrades}
                    onChange={(e) => handleInputChange("allowShortTrades", e.target.checked)}
                    className="w-4 h-4 text-primary border-border rounded focus:ring-primary"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Notifications */}
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-2 pb-2 border-b border-border/60">
              <Bell className="text-primary h-5 w-5" />
              <h2 className="text-sm font-black uppercase tracking-wider text-foreground">
                System Alerts
              </h2>
            </div>

            <div className="space-y-4 pt-1">
              <div className="flex items-center justify-between text-xs font-bold text-foreground">
                <span className="uppercase text-muted-foreground">Email Notifications</span>
                <input
                  type="checkbox"
                  checked={!!settings?.notifications?.email}
                  onChange={(e) => handleNotificationChange("email", e.target.checked)}
                  className="w-4 h-4 text-primary border-border rounded focus:ring-primary"
                />
              </div>

              <div className="flex items-center justify-between text-xs font-bold text-foreground">
                <span className="uppercase text-muted-foreground">Trade Executed Alert</span>
                <input
                  type="checkbox"
                  checked={!!settings?.notifications?.tradeExecuted}
                  onChange={(e) => handleNotificationChange("tradeExecuted", e.target.checked)}
                  className="w-4 h-4 text-primary border-border rounded focus:ring-primary"
                />
              </div>

              <div className="flex items-center justify-between text-xs font-bold text-foreground">
                <span className="uppercase text-muted-foreground">Trade Closed Alert</span>
                <input
                  type="checkbox"
                  checked={!!settings?.notifications?.tradeClosed}
                  onChange={(e) => handleNotificationChange("tradeClosed", e.target.checked)}
                  className="w-4 h-4 text-primary border-border rounded focus:ring-primary"
                />
              </div>

              <div className="flex items-center justify-between text-xs font-bold text-foreground">
                <span className="uppercase text-muted-foreground">Low Balance Warnings</span>
                <input
                  type="checkbox"
                  checked={!!settings?.notifications?.lowBalance}
                  onChange={(e) => handleNotificationChange("lowBalance", e.target.checked)}
                  className="w-4 h-4 text-primary border-border rounded focus:ring-primary"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Submit Bar */}
        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${saveSuccess ? "bg-green-500/10 text-green-500" : "bg-primary/10 text-primary"}`}>
              {saveSuccess ? <ShieldCheck size={18} /> : <SlidersHorizontal size={18} />}
            </div>
            <div>
              <p className="text-[11px] font-black uppercase text-foreground">
                {saveSuccess ? "Settings Synchronized" : "Unsaved Changes"}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {saveSuccess ? "All parameters updated successfully." : "Modify trading parameters and save."}
              </p>
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground text-[11px] font-black uppercase tracking-widest rounded-xl hover:opacity-90 transition-all shadow-md active:scale-95 disabled:opacity-50"
          >
            {saving ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Save size={13} /> Save changes
              </>
            )}
          </button>
        </div>
      </form>

      {/* Engine Control Section */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-2 pb-4 border-b border-border/60 mb-6">
          <Cpu className="text-primary h-5 w-5" />
          <h2 className="text-sm font-black uppercase tracking-wider text-foreground">
            AI Engine Operations
          </h2>
        </div>
        
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-6 bg-muted/20 border border-border rounded-2xl">
          <div className="flex flex-col space-y-1">
            <span className="text-xs font-black uppercase text-muted-foreground tracking-widest">
              Automated Trading Engine
            </span>
            <p className="text-sm text-muted-foreground max-w-md">
              When active, the AI engine will autonomously analyze MCX market data and execute trades based on your risk parameters.
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className={`w-2.5 h-2.5 rounded-full ${engineEnabled ? "bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.4)]" : "bg-red-500"}`} />
              <span className={`text-xs font-black uppercase ${engineEnabled ? "text-green-500" : "text-red-500"}`}>
                Engine {engineEnabled ? "Active" : "Stopped"}
              </span>
            </div>
          </div>
          
          <button
            onClick={handleToggleEngine}
            disabled={loadingEngineAction}
            className={`flex items-center gap-3 px-8 py-4 text-xs uppercase font-black tracking-[0.2em] rounded-2xl transition-all shadow-lg active:scale-95 ${
              engineEnabled
                ? "bg-red-500 text-white shadow-red-500/20 border border-red-600 hover:bg-red-600"
                : "bg-primary text-primary-foreground shadow-primary/30 border border-primary/20 hover:opacity-90"
            }`}
          >
            {loadingEngineAction ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : engineEnabled ? (
              <>
                <Square size={16} fill="white" /> STOP ENGINE
              </>
            ) : (
              <>
                <Play size={16} fill="white" /> START ENGINE
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
