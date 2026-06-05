"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMcxAuthStore } from "@/store/useMcxAuthStore";
import { motion } from "framer-motion";
import { ArrowRight, Mail, Lock, User, Loader2 } from "lucide-react";
import { AuthLayout } from "@/components/auth/auth-layout";

export default function McxRegisterPage() {
  const router = useRouter();
  const { register, isAuthenticated, isLoading, error, setError } = useMcxAuthStore();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    setLocalError(null);
  }, [setError]);

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/mcx");
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setError(null);

    if (!username.trim() || !email.trim() || !password || !confirmPassword) {
      setLocalError("All fields are required");
      return;
    }

    if (password !== confirmPassword) {
      setLocalError("Passwords do not match");
      return;
    }

    const res = await register({
      username: username.trim(),
      email: email.trim(),
      password,
      confirmPassword,
    });

    if (res.success) {
      router.push("/mcx");
    }
  };

  return (
    <AuthLayout>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full"
      >
        <div className="mb-8 text-center lg:text-left">
          <h2 className="text-3xl font-black text-foreground mb-2 tracking-tight uppercase">Create Account</h2>
          <p className="text-muted-foreground font-medium">Join MCX institutional trading workspace</p>
        </div>

        {(localError || error) && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="p-4 mb-6 text-sm text-destructive bg-destructive/10 rounded-xl border border-destructive/20 font-bold" 
          >
            {localError || error}
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="username-input" className="block text-xs font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">
              Username
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                <User className="h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
              </div>
              <input
                id="username-input"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
                className="w-full pl-12 pr-4 py-3 bg-muted/30 border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 text-foreground placeholder-muted-foreground/50 transition-all backdrop-blur-sm disabled:opacity-50 font-medium"
                placeholder="johndoe"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="email-input" className="block text-xs font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">
              Email Address
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                <Mail className="h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
              </div>
              <input
                id="email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                className="w-full pl-12 pr-4 py-3 bg-muted/30 border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 text-foreground placeholder-muted-foreground/50 transition-all backdrop-blur-sm disabled:opacity-50 font-medium"
                placeholder="name@example.com"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password-input" className="block text-xs font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">
              Password
            </label>
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
                className="w-full pl-12 pr-4 py-3 bg-muted/30 border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 text-foreground placeholder-muted-foreground/50 transition-all backdrop-blur-sm disabled:opacity-50 font-medium"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="confirm-password-input" className="block text-xs font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">
              Confirm Password
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                <Lock className="h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
              </div>
              <input
                id="confirm-password-input"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
                className="w-full pl-12 pr-4 py-3 bg-muted/30 border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 text-foreground placeholder-muted-foreground/50 transition-all backdrop-blur-sm disabled:opacity-50 font-medium"
                placeholder="••••••••"
              />
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={isLoading}
            className="group relative w-full flex justify-center items-center py-4 px-6 border border-transparent rounded-2xl text-xs font-black uppercase tracking-widest text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 disabled:opacity-75 disabled:cursor-not-allowed overflow-hidden mt-6"
          >
            {isLoading ? (
              <Loader2 className="animate-spin h-5 w-5" />
            ) : (
              <>
                Create Account
                <ArrowRight className="ml-2 h-4 w-4 opacity-80 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </motion.button>
        </form>

        <div className="mt-8 text-center text-sm text-muted-foreground font-medium">
          Already have an account?{" "}
          <Link
            href="/mcx/login"
            className="font-black text-foreground hover:text-primary transition-colors underline decoration-primary/20 underline-offset-4"
          >
            Sign in
          </Link>
        </div>
      </motion.div>
    </AuthLayout>
  );
}
