import { create } from "zustand";

interface UIState {
  activeTab: "dashboard" | "intelligence" | "positions" | "history";
  sidebarOpen: boolean;
  
  setActiveTab: (tab: "dashboard" | "intelligence" | "positions" | "history") => void;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeTab: "dashboard",
  sidebarOpen: true,

  setActiveTab: (tab) => set({ activeTab: tab }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}));
