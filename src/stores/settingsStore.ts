import { create } from "zustand";

export interface UserSettings {
  autoTrading: boolean;
  riskPerTradePct: number;
  maxOpenTrades: number;
  defaultSlPct: number;
  defaultTpPct: number;
  prefTimeframe: string;
  prefSymbol: string;
}

export interface SettingsState extends UserSettings {
  loading: boolean;
  error: string | null;
  
  fetchSettings: (userId: string) => Promise<void>;
  updateSettings: (userId: string, updates: Partial<UserSettings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  autoTrading: false,
  riskPerTradePct: 2.0,
  maxOpenTrades: 3,
  defaultSlPct: 1.5,
  defaultTpPct: 3.0,
  prefTimeframe: "15m",
  prefSymbol: "BTCUSDT",
  loading: false,
  error: null,

  fetchSettings: async (userId: string) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`/api/settings?userId=${encodeURIComponent(userId)}`);
      const data = await res.json();
      if (data.success && data.settings) {
        set({
          autoTrading: data.settings.autoTrading,
          riskPerTradePct: data.settings.riskPerTradePct,
          maxOpenTrades: data.settings.maxOpenTrades,
          defaultSlPct: data.settings.defaultSlPct,
          defaultTpPct: data.settings.defaultTpPct,
          prefTimeframe: data.settings.prefTimeframe,
          prefSymbol: data.settings.prefSymbol,
          loading: false,
        });
      } else {
        set({ error: "Failed to load settings", loading: false });
      }
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  updateSettings: async (userId: string, updates: Partial<UserSettings>) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...updates }),
      });
      const data = await res.json();
      if (data.success && data.settings) {
        set({
          ...data.settings,
          loading: false,
        });
      } else {
        set({ error: "Failed to update settings", loading: false });
      }
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },
}));
