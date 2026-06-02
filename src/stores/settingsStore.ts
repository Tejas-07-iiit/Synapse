import { create } from "zustand";

export interface UserSettings {
  autoTrading: boolean;
  maxOpenTrades: number;
  prefSymbol: string;
  preferredTradingMode: "SCALPING" | "INTRADAY";
}

export interface SettingsState extends UserSettings {
  loading: boolean;
  error: string | null;
  
  fetchSettings: (userId: string) => Promise<void>;
  updateSettings: (userId: string, updates: Partial<UserSettings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  autoTrading: false,
  maxOpenTrades: 3,
  prefSymbol: "BTCUSDT",
  preferredTradingMode: "INTRADAY",
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
          maxOpenTrades: data.settings.maxOpenTrades,
          prefSymbol: data.settings.prefSymbol,
          preferredTradingMode: data.settings.preferredTradingMode,
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
