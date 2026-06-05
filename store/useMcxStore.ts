import { create } from "zustand";

interface McxState {
  selectedCommodity: string;
  setSelectedCommodity: (symbol: string) => void;
  livePrice: number;
  prevPrice: number;
  priceTrend: "up" | "down" | "flat";
  updateLivePrice: (price: number) => void;
  botEnabled: boolean;
  setBotEnabled: (enabled: boolean) => void;
  isTradingLive: boolean;
  setIsTradingLive: (live: boolean) => void;
}

export const useMcxStore = create<McxState>((set) => ({
  selectedCommodity: "GOLD",
  setSelectedCommodity: (symbol) => set({ 
    selectedCommodity: symbol,
    livePrice: 0,
    prevPrice: 0,
    priceTrend: "flat"
  }),
  livePrice: 0,
  prevPrice: 0,
  priceTrend: "flat",
  updateLivePrice: (price) => set((state) => {
    if (price === state.livePrice) return state;
    const trend = price > state.livePrice ? "up" : price < state.livePrice ? "down" : "flat";
    return {
      prevPrice: state.livePrice,
      livePrice: price,
      priceTrend: trend
    };
  }),
  botEnabled: false,
  setBotEnabled: (enabled) => set({ botEnabled: enabled }),
  isTradingLive: true,
  setIsTradingLive: (live) => set({ isTradingLive: live })
}));
