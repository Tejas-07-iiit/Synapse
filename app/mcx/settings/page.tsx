"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMcxAuthStore } from "@/store/useMcxAuthStore";
import { 
  Settings, 
  Save, 
  RefreshCw, 
  Sliders, 
  ShieldCheck, 
  Bell, 
  SlidersHorizontal 
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
  tradingInterval: string;
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
  const [settings, setSettings] = useState<UserSettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

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

  useEffect(() => {
    fetchSettings();
  }, []);

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
    <div className="space-y-6">
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
                  min="1"
                  max="50"
                  value={settings?.defaultLots || 1}
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
                  min="1"
                  max="100"
                  value={settings?.maxLotsPerTrade || 5}
                  onChange={(e) => handleInputChange("maxLotsPerTrade", Number(e.target.value))}
                  className="w-full px-4 py-3 bg-muted/20 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-orange-500 text-foreground font-mono"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-black uppercase tracking-wider text-muted-foreground">
                  Analysis Interval
                </label>
                <select
                  value={settings?.tradingInterval || "5m"}
                  onChange={(e) => handleInputChange("tradingInterval", e.target.value)}
                  className="w-full px-4 py-3 bg-muted/20 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-orange-500 text-foreground font-semibold"
                >
                  <option value="1m">1 Minute</option>
                  <option value="5m">5 Minutes</option>
                  <option value="15m">15 Minutes</option>
                  <option value="30m">30 Minutes</option>
                  <option value="1h">1 Hour</option>
                </select>
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
                  min="1"
                  max="100"
                  value={settings?.maxMarginUsagePercent || 80}
                  onChange={(e) => handleInputChange("maxMarginUsagePercent", Number(e.target.value))}
                  className="w-full px-4 py-3 bg-muted/20 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-orange-500 text-foreground font-mono"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-black uppercase tracking-wider text-muted-foreground">
                  Daily Loss Limit (%)
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={settings?.dailyLossLimitPercent || 15}
                  onChange={(e) => handleInputChange("dailyLossLimitPercent", Number(e.target.value))}
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
          <div className="flex-1">
            <AnimatePresence>
              {saveSuccess && (
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="text-xs font-bold text-green-500 uppercase tracking-widest block"
                >
                  ✓ Configuration Updated successfully
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 border border-transparent rounded-xl text-xs font-black uppercase tracking-widest text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary shadow-md shadow-primary/10 active:scale-95 transition-all"
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
    </div>
  );
}
