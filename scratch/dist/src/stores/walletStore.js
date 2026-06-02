import { create } from "zustand";
export const useWalletStore = create((set) => ({
    balance: 0,
    totalDeposited: 0,
    totalWithdrawn: 0,
    realizedPnl: 0,
    loading: false,
    error: null,
    fetchWallet: async (userId, silent = false) => {
        if (!silent)
            set({ loading: true, error: null });
        try {
            const res = await fetch(`/api/wallet?userId=${encodeURIComponent(userId)}`);
            const data = await res.json();
            if (data.success && data.wallet) {
                set({
                    balance: data.wallet.balance,
                    totalDeposited: data.wallet.totalDeposited,
                    totalWithdrawn: data.wallet.totalWithdrawn,
                    realizedPnl: data.wallet.realizedPnl,
                    loading: false,
                });
            }
            else {
                set({ error: "Failed to load wallet", loading: false });
            }
        }
        catch (error) {
            set({ error: error.message, loading: false });
        }
    },
    updateBalance: (pnl) => {
        set((state) => ({
            balance: state.balance + pnl,
            realizedPnl: state.realizedPnl + pnl,
        }));
    },
}));
