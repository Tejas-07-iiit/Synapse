"use client";

import React, { useEffect, useState } from "react";
import { useMcxAuthStore } from "@/store/useMcxAuthStore";
import { useRouter } from "next/navigation";
import MCXLoader from "@/components/mcx/MCXLoader";
import Sidebar from "@/components/mcx/Sidebar";
import Topbar from "@/components/mcx/Topbar";

export default function McxLayout({ children }: { children: React.ReactNode }) {
  const { user, fetchMe, isAuthenticated, isLoading } = useMcxAuthStore();
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchMe().finally(() => {
      setMounted(true);
    });
  }, [fetchMe]);

  useEffect(() => {
    if (mounted && !isLoading && !isAuthenticated) {
      router.push("/mcx/login");
    }
  }, [mounted, isLoading, isAuthenticated, router]);

  if (!mounted || isLoading) {
    return <MCXLoader message="Starting MCX Terminal..." />;
  }

  if (!isAuthenticated) {
    return <MCXLoader message="Redirecting to terminal login..." />;
  }

  return (
    <div className="flex h-screen w-screen bg-background text-foreground overflow-hidden font-sans transition-colors duration-300">
      {/* Sticky Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-background/95">
        {/* Shared Dashboard Topbar */}
        <Topbar />

        {/* Workspace Body */}
        <main className="flex-1 px-8 py-6 pb-16 space-y-6 min-h-0">
          {children}
        </main>
      </div>
    </div>
  );
}
