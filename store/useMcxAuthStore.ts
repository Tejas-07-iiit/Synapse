import { create } from "zustand";

interface McxUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  engineEnabled: boolean;
  subscriptionPlan: string;
}

interface McxAuthState {
  user: McxUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  setError: (error: string | null) => void;
  register: (data: any) => Promise<{ success: boolean; error?: string }>;
  login: (data: any) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  setEngineEnabled: (enabled: boolean) => void;
}

export const useMcxAuthStore = create<McxAuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  setError: (error) => set({ error }),

  setEngineEnabled: (enabled) => set((state) => ({
    user: state.user ? { ...state.user, engineEnabled: enabled } : null
  })),

  register: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch("/api/mcx/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.message || "Failed to register");
      }
      set({ isLoading: false });
      return { success: true };
    } catch (err: any) {
      const msg = err.message || "Registration failed";
      set({ error: msg, isLoading: false });
      return { success: false, error: msg };
    }
  },

  login: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch("/api/mcx/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.message || "Failed to login");
      }
      set({ user: result.user, isAuthenticated: true, isLoading: false });
      return { success: true };
    } catch (err: any) {
      const msg = err.message || "Login failed";
      set({ error: msg, isLoading: false });
      return { success: false, error: msg };
    }
  },

  logout: async () => {
    set({ isLoading: true, error: null });
    try {
      await fetch("/api/mcx/auth/logout", { method: "POST" });
    } catch (err) {
      console.error("Logout error on client:", err);
    } finally {
      set({ user: null, isAuthenticated: false, isLoading: false });
      if (typeof window !== "undefined") {
        window.location.href = "/mcx/login";
      }
    }
  },

  fetchMe: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch("/api/auth/me");
      const result = await res.json();
      if (res.ok && result.authenticated) {
        // Map main user to McxUser format if needed, or just use the same data
        const mcxUser: McxUser = {
          id: result.user.id,
          firstName: result.user.username,
          lastName: "User",
          email: result.user.email,
          role: "user",
          engineEnabled: false, // Default or fetch from mcx settings
          subscriptionPlan: "pro"
        };
        set({ user: mcxUser, isAuthenticated: true, isLoading: false });
      } else {
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    } catch (err) {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
