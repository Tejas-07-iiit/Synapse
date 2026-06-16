import { create } from "zustand";

interface McxState {
  selectedCommodity: string;
  setSelectedCommodity: (symbol: string) => void;
  livePrice: number;
  prevPrice: number;
  priceTrend: "up" | "down" | "flat";
  activeContractName: string | null;
  setActiveContractName: (name: string | null) => void;
  updateLivePrice: (price: number) => void;
  engineEnabled: boolean;
  setEngineEnabled: (enabled: boolean) => void;
  isTradingLive: boolean;
  setIsTradingLive: (live: boolean) => void;
}

export const useMcxStore = create<McxState>((set) => ({
  selectedCommodity: "GOLD",
  setSelectedCommodity: (symbol) => set({ 
    selectedCommodity: symbol,
    livePrice: 0,
    prevPrice: 0,
    priceTrend: "flat",
    activeContractName: null
  }),
  livePrice: 0,
  prevPrice: 0,
  priceTrend: "flat",
  activeContractName: null,
  setActiveContractName: (name) => set({ activeContractName: name }),
  updateLivePrice: (price) => set((state) => {
    if (price === state.livePrice) return state;
    const trend = price > state.livePrice ? "up" : price < state.livePrice ? "down" : "flat";
    return {
      prevPrice: state.livePrice,
      livePrice: price,
      priceTrend: trend
    };
  }),
  engineEnabled: false,
  setEngineEnabled: (enabled) => set({ engineEnabled: enabled }),
  isTradingLive: true,
  setIsTradingLive: (live) => set({ isTradingLive: live })
}));
