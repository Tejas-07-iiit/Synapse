import { create } from "zustand";
import { TradingStrategy } from "../strategy-engine/types";

interface StrategyState {
  registeredStrategies: TradingStrategy[];
  runningStrategyIds: Set<string>;
  
  setRegisteredStrategies: (strategies: TradingStrategy[]) => void;
  toggleStrategyRunning: (id: string) => void;
  setStrategyRunning: (id: string, running: boolean) => void;
}

export const useStrategyStore = create<StrategyState>((set) => ({
  registeredStrategies: [],
  runningStrategyIds: new Set<string>(),

  setRegisteredStrategies: (strategies) => set({ registeredStrategies: strategies }),
  
  toggleStrategyRunning: (id) =>
    set((state) => {
      const running = new Set(state.runningStrategyIds);
      if (running.has(id)) {
        running.delete(id);
      } else {
        running.add(id);
      }
      return { runningStrategyIds: running };
    }),

  setStrategyRunning: (id, running) =>
    set((state) => {
      const runningIds = new Set(state.runningStrategyIds);
      if (running) {
        runningIds.add(id);
      } else {
        runningIds.delete(id);
      }
      return { runningStrategyIds: runningIds };
    }),
}));
