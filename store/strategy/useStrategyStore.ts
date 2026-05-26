import { create } from "zustand";
import { StrategySignal } from "@/types/strategy";

interface StrategyState {
  activeSignals: StrategySignal[];
  addSignal: (signal: StrategySignal) => void;
  clearSignals: () => void;
  setSignals: (signals: StrategySignal[]) => void;
}

export const useStrategyStore = create<StrategyState>((set) => ({
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
  clearSignals: () => set({ activeSignals: [] }),
  setSignals: (signals) => set({ activeSignals: signals }),
}));
