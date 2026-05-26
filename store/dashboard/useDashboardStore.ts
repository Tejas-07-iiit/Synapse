import { create } from "zustand";
import { TickerInfo } from "@/types/market";

interface DashboardState {
  selectedSymbol: string;
  supportedSymbols: string[];
  tickerData: Record<string, TickerInfo>;
  wsConnected: boolean;
  wsError: string | null;

  setSymbol: (symbol: string) => void;
  setSupportedSymbols: (symbols: string[]) => void;
  updateTicker: (symbol: string, data: TickerInfo) => void;
  setWsConnectionState: (connected: boolean, error?: string | null) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  selectedSymbol: "BTCUSDT",
  supportedSymbols: [],
  tickerData: {},
  wsConnected: false,
  wsError: null,

  setSymbol: (symbol) => set({ selectedSymbol: symbol.toUpperCase() }),
  
  setSupportedSymbols: (symbols) => set({ 
    supportedSymbols: symbols.map(s => s.toUpperCase()),
    // Initialize selectedSymbol to the first supported coin if available
    selectedSymbol: symbols.length > 0 ? symbols[0].toUpperCase() : "BTCUSDT"
  }),
  
  updateTicker: (symbol, data) => 
    set((state) => ({
      tickerData: {
        ...state.tickerData,
        [symbol.toUpperCase()]: data,
      },
    })),
    
  setWsConnectionState: (connected, error = null) => 
    set({ wsConnected: connected, wsError: error }),
}));
