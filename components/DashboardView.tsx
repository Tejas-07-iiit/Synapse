"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { 
  LayoutDashboard, 
  User as UserIcon, 
  Settings, 
  LogOut, 
  Mail, 
  Calendar, 
  Shield 
} from "lucide-react";

export default function DashboardView() {
  const router = useRouter();
  const { user, logout, isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    // If auth state is resolved and not authenticated, redirect to login
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground font-medium">Authenticating Session...</p>
        </div>
      </div>
    );
  }

  // Fallback if user is null (though middleware/useEffect guards it)
  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden font-sans transition-colors duration-300">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col h-full shrink-0 border-r border-sidebar-border">
        <div className="p-6 border-b border-sidebar-border flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <Shield className="text-primary-foreground" size={18} />
          </div>
          <span className="text-xl font-bold tracking-tight text-foreground uppercase">SYNAPSE</span>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1.5">
          <a
            href="#"
            className="flex items-center gap-3 px-3 py-2 bg-primary text-primary-foreground rounded-lg font-medium transition shadow-md shadow-primary/10"
          >
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </a>
          <a
            href="#"
            className="flex items-center gap-3 px-3 py-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-lg transition group"
          >
            <Shield size={18} className="group-hover:text-primary transition-colors" />
            <span>Security Terminal</span>
          </a>
          <a
            href="#"
            className="flex items-center gap-3 px-3 py-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-lg transition group"
          >
            <Settings size={18} className="group-hover:text-primary transition-colors" />
            <span>System Settings</span>
          </a>
        </nav>

        {/* Bottom logout section */}
        <div className="p-4 border-t border-sidebar-border">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white bg-red-600 hover:bg-red-500 rounded-xl transition-all duration-300 shadow-lg shadow-red-600/20 active:scale-95 border border-red-500/20"
          >
            <LogOut size={18} strokeWidth={3} />
            <span>Log Out</span>
          </button>
        </div>

      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-y-auto bg-background/95">
        {/* Header */}
        <header className="bg-card/50 backdrop-blur-md border-b border-border px-8 py-4 flex items-center justify-between sticky top-0 z-20">
          <h1 className="text-lg font-bold text-foreground uppercase tracking-wider">System Command</h1>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end">
                <span className="text-xs font-bold text-foreground">{user.username}</span>
                <span className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter">Verified Agent</span>
              </div>
              <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                <UserIcon size={14} className="text-primary" />
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Body */}
        <main className="p-8 space-y-8 max-w-7xl mx-auto w-full">
          {/* Welcome Message */}
          <div className="bg-card p-8 rounded-2xl shadow-sm border border-border relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
              <Shield size={120} className="text-primary" />
            </div>
            <div className="relative z-10">
              <h2 className="text-3xl font-bold text-foreground tracking-tight">
                Welcome back, <span className="text-primary underline decoration-primary/30 underline-offset-8">{user.username}</span>
              </h2>
              <p className="text-muted-foreground mt-3 max-w-2xl leading-relaxed font-medium">
                Your institutional-grade terminal is operational. All security modules are active and encrypted. 
                Monitor your assets with real-time analytics and AI-powered intelligence.
              </p>
            </div>
          </div>

          {/* Stats Placeholder Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-card p-6 rounded-2xl shadow-sm border border-border group hover:border-primary/50 transition-colors">
              <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4">
                System Health
              </h3>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold text-green-500 tracking-tight">OPERATIONAL</p>
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              </div>
              <span className="text-[10px] text-muted-foreground mt-2 block font-bold uppercase">Auth Link Secure</span>
            </div>

            <div className="bg-card p-6 rounded-2xl shadow-sm border border-border group hover:border-primary/50 transition-colors">
              <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4">
                Engine Provider
              </h3>
              <p className="text-2xl font-bold text-foreground tracking-tight uppercase">PostgreSQL</p>
              <span className="text-[10px] text-muted-foreground mt-2 block font-bold uppercase italic">V16.x via Prisma</span>
            </div>

            <div className="bg-card p-6 rounded-2xl shadow-sm border border-border group hover:border-primary/50 transition-colors">
              <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4">
                Session Uplink
              </h3>
              <p className="text-2xl font-bold text-primary tracking-tight uppercase">ACTIVE</p>
              <span className="text-[10px] text-muted-foreground mt-2 block font-bold uppercase underline decoration-primary/20">Secured via HTTP-Only</span>
            </div>
          </div>

          {/* User Information Details Card */}
          <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
            <div className="px-8 py-5 border-b border-border bg-muted/30">
              <h3 className="text-sm font-bold text-foreground uppercase tracking-widest">Agent Credentials</h3>
            </div>
            <div className="p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2 border-b border-border/50">
                <span className="text-xs font-black text-muted-foreground uppercase tracking-widest">Universal Agent ID</span>
                <span className="text-xs font-mono text-foreground font-bold bg-muted px-2 py-1 rounded border border-border/50 mt-2 sm:mt-0">{user.id}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <UserIcon size={14} className="text-primary" />
                  <span className="text-xs font-black text-muted-foreground uppercase tracking-widest">Public Handle</span>
                </div>
                <span className="text-sm text-foreground font-bold mt-1 sm:mt-0">{user.username}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <Mail size={14} className="text-primary" />
                  <span className="text-xs font-black text-muted-foreground uppercase tracking-widest">Encrypted Mailbox</span>
                </div>
                <span className="text-sm text-foreground font-bold mt-1 sm:mt-0">{user.email}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2">
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-primary" />
                  <span className="text-xs font-black text-muted-foreground uppercase tracking-widest">Enlistment Date</span>
                </div>
                <span className="text-sm text-foreground font-bold mt-1 sm:mt-0">
                  {new Date(user.createdAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
