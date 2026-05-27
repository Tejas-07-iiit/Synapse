import { create } from "zustand";

interface ChartState {
  chartType: "candlestick" | "line";
  showVolume: boolean;
  showEma20: boolean;
  showSma50: boolean;
  showBollinger: boolean;
  
  setChartType: (type: "candlestick" | "line") => void;
  toggleVolume: () => void;
  toggleEma20: () => void;
  toggleSma50: () => void;
  toggleBollinger: () => void;
}

export const useChartStore = create<ChartState>((set) => ({
  chartType: "candlestick",
  showVolume: true,
  showEma20: true,
  showSma50: true,
  showBollinger: false,

  setChartType: (type) => set({ chartType: type }),
  toggleVolume: () => set((state) => ({ showVolume: !state.showVolume })),
  toggleEma20: () => set((state) => ({ showEma20: !state.showEma20 })),
  toggleSma50: () => set((state) => ({ showSma50: !state.showSma50 })),
  toggleBollinger: () => set((state) => ({ showBollinger: !state.showBollinger })),
}));
