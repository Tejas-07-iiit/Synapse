import { create } from "zustand";
import { StrategySignal } from "../strategy-engine/types";

interface SignalState {
  activeSignals: StrategySignal[];
  
  addSignal: (signal: StrategySignal) => void;
  setSignals: (signals: StrategySignal[]) => void;
  clearSignals: () => void;
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
}));
