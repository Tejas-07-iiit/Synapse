"use client";

import React from "react";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  subValue?: string | React.ReactNode;
  icon: LucideIcon;
  trend?: "up" | "down" | "neutral";
}

export function StatCard({ title, value, subValue, icon: Icon, trend }: StatCardProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
      <div className="space-y-1">
        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest block">
          {title}
        </span>
        <span className="text-lg font-bold text-foreground block">
          {value}
        </span>
        {subValue && (
          <span 
            className={`text-[10px] font-bold block uppercase tracking-tight ${
              trend === "up" ? "text-emerald-500" : trend === "down" ? "text-destructive" : "text-muted-foreground/60"
            }`}
          >
            {subValue}
          </span>
        )}
      </div>
      <div className={`p-3 rounded-xl border shadow-inner ${
        trend === "up" 
          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" 
          : trend === "down"
          ? "bg-destructive/10 border-destructive/20 text-destructive"
          : "bg-primary/10 border-primary/20 text-primary"
      }`}>
        <Icon size={18} />
      </div>
    </div>
  );
}
