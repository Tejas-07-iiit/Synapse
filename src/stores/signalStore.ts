import { create } from "zustand";
import { StrategySignal } from "../strategy-engine/types";

interface SignalState {
  activeSignals: StrategySignal[];
  
  addSignal: (signal: StrategySignal) => void;
  setSignals: (signals: StrategySignal[]) => void;
  clearSignals: () => void;
  fetchSignals: () => Promise<void>;
}

export const useSignalStore = create<SignalState>((set) => ({
  activeSignals: [],

  addSignal: (signal) =>
    set((state) => {
      // Avoid duplicate signals for the same symbol, strategy, and timestamp
      const exists = state.activeSignals.some(
        (s) =>
          s.symbol === signal.symbol &&
          s.strategyId === signal.strategyId &&
          s.timestamp === signal.timestamp
      );

      if (exists) return {};

      // Insert new signal at the beginning (newest first) and keep up to 100 signals
      const updated = [signal, ...state.activeSignals].slice(0, 100);
      return { activeSignals: updated };
    }),

  setSignals: (signals) => set({ activeSignals: signals }),
  clearSignals: () => set({ activeSignals: [] }),
  fetchSignals: async (userId?: string) => {
    try {
      const url = userId 
        ? `/api/signals?limit=100&userId=${encodeURIComponent(userId)}`
        : "/api/signals?limit=100";
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && Array.isArray(data.signals)) {
        set({ activeSignals: data.signals });
      }
    } catch (e) {
      console.error("Failed to fetch signals:", e);
    }
  },
}));
