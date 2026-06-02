import { create } from "zustand";
import { RegisterInput, LoginInput, User } from "@/types/auth";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  setError: (error: string | null) => void;
  register: (data: RegisterInput) => Promise<{ success: boolean; error?: string }>;
  login: (data: LoginInput) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  setError: (error) => set({ error }),

  register: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Failed to register");
      }
      set({ user: result.user, isAuthenticated: true, isLoading: false });
      return { success: true };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Registration failed";
      set({ error: errorMessage, isLoading: false });
      return { success: false, error: errorMessage };
    }
  },

  login: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Failed to login");
      }
      set({ user: result.user, isAuthenticated: true, isLoading: false });
      return { success: true };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Login failed";
      set({ error: errorMessage, isLoading: false });
      return { success: false, error: errorMessage };
    }
  },

  logout: async () => {
    set({ isLoading: true, error: null });
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      console.error("Logout error on client:", err);
    } finally {
      set({ user: null, isAuthenticated: false, isLoading: false });
      // Hard redirect to login page to ensure cookie is cleared and middleware runs
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
  },

  fetchMe: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch("/api/auth/me");
      const result = await res.json();
      if (res.ok && result.authenticated) {
        set({ user: result.user, isAuthenticated: true, isLoading: false });
      } else {
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    } catch (err) {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
