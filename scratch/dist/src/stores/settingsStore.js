import { create } from "zustand";
export const useSettingsStore = create((set) => ({
    autoTrading: false,
    riskPerTradePct: 2.0,
    maxOpenTrades: 3,
    defaultSlPct: 1.5,
    defaultTpPct: 3.0,
    prefSymbol: "BTCUSDT",
    preferredTradingMode: "INTRADAY",
    loading: false,
    error: null,
    fetchSettings: async (userId) => {
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
                    prefSymbol: data.settings.prefSymbol,
                    preferredTradingMode: data.settings.preferredTradingMode,
                    loading: false,
                });
            }
            else {
                set({ error: "Failed to load settings", loading: false });
            }
        }
        catch (error) {
            set({ error: error.message, loading: false });
        }
    },
    updateSettings: async (userId, updates) => {
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
            }
            else {
                set({ error: "Failed to update settings", loading: false });
            }
        }
        catch (error) {
            set({ error: error.message, loading: false });
        }
    },
}));
