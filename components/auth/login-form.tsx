"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/useAuthStore";
import { motion } from "framer-motion";
import { ArrowRight, Mail, Lock, Loader2 } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading, error, setError } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  // Clear errors when navigating away or on mount
  useEffect(() => {
    setError(null);
    setLocalError(null);
  }, [setError]);

  // If user is already authenticated, redirect to dashboard
  useEffect(() => {
    if (isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setError(null);

    // Validation
    if (!email.trim()) {
      setLocalError("Email or Username is required");
      return;
    }
    if (!password) {
      setLocalError("Password is required");
      return;
    }

    const res = await login({ email: email.trim(), password });
    if (res.success) {
      router.push("/dashboard");
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full"
    >
      <div className="mb-10 text-center lg:text-left">
        <h2 className="text-3xl font-black text-foreground mb-2 tracking-tight uppercase">Welcome back</h2>
        <p className="text-muted-foreground font-medium">Enter your credentials to access your workspace</p>
      </div>
      
      {(localError || error) && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="p-4 mb-6 text-sm text-destructive bg-destructive/10 rounded-xl border border-destructive/20 font-bold" 
          id="login-error-message"
        >
          {localError || error}
        </motion.div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="email-input" className="block text-xs font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">
            Email or Username
          </label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
              <Mail className="h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
            </div>
            <input
              id="email-input"
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              className="w-full pl-12 pr-4 py-4 bg-muted/30 border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 text-foreground placeholder-muted-foreground/50 transition-all backdrop-blur-sm disabled:opacity-50 font-medium"
              placeholder="Enter your email or username"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between ml-1">
            <label htmlFor="password-input" className="block text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
              Password
            </label>
            <Link href="#" className="text-xs font-bold text-primary hover:text-primary/80 transition-colors uppercase tracking-widest">
              Forgot?
            </Link>
          </div>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
              <Lock className="h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
            </div>
            <input
              id="password-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              className="w-full pl-12 pr-4 py-4 bg-muted/30 border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 text-foreground placeholder-muted-foreground/50 transition-all backdrop-blur-sm disabled:opacity-50 font-medium"
              placeholder="••••••••"
            />
          </div>
        </div>

        <button
          id="login-submit-btn"
          type="submit"
          disabled={isLoading}
          className="group relative w-full flex justify-center items-center py-4 px-6 border border-transparent rounded-2xl text-sm font-black uppercase tracking-widest text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 overflow-hidden"
        >
          {isLoading ? (
            <Loader2 className="animate-spin h-5 w-5 text-primary-foreground" />
          ) : (
            <>
              Sign in
              <ArrowRight className="ml-2 h-5 w-5 opacity-70 group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </button>
      </form>

      <div className="mt-8 text-center text-sm text-muted-foreground font-medium">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-black text-foreground hover:text-primary transition-colors underline decoration-primary/20 underline-offset-4">
          Create an account
        </Link>
      </div>
    </motion.div>
  );
}
