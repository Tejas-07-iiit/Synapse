"use client";

import React from "react";
import { Gauge } from "lucide-react";

interface MarketScoreProps {
  score: number;
}

export default function MarketScore({ score }: MarketScoreProps) {
  // Determine color theme based on score
  // Bullish: green, Bearish: red, Neutral: yellow/amber
  let color = "text-amber-500";
  let strokeColor = "#f59e0b";
  let label = "Neutral";
  let bgGradient = "from-amber-500/10 to-amber-500/0 border-amber-500/20";
  
  if (score >= 60) {
    color = "text-green-500";
    strokeColor = "#10b981";
    label = "Bullish";
    bgGradient = "from-green-500/10 to-green-500/0 border-green-500/20";
  } else if (score <= 40) {
    color = "text-red-500";
    strokeColor = "#ef4444";
    label = "Bearish";
    bgGradient = "from-red-500/10 to-red-500/0 border-red-500/20";
  }

  // Radial calculations for SVG circle
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className={`bg-card border rounded-2xl p-6 flex flex-col items-center justify-center relative overflow-hidden bg-gradient-to-b ${bgGradient} shadow-sm hover:shadow-md transition-all h-full min-h-[220px]`}>
      <div className="absolute top-4 left-4 flex items-center gap-1.5 text-muted-foreground text-[10px] font-bold uppercase tracking-wider">
        <Gauge size={14} className={color} />
        <span>Market Score</span>
      </div>

      <div className="relative flex items-center justify-center mt-4">
        {/* SVG Circle Gauge */}
        <svg className="w-36 h-36 transform -rotate-90">
          {/* Background circle */}
          <circle
            cx="72"
            cy="72"
            r={radius}
            className="stroke-muted-foreground/10"
            strokeWidth="8"
            fill="transparent"
          />
          {/* Progress circle */}
          <circle
            cx="72"
            cy="72"
            r={radius}
            stroke={strokeColor}
            strokeWidth="10"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>

        {/* Value Label Overlay */}
        <div className="absolute flex flex-col items-center justify-center">
          <span className={`text-4xl font-extrabold tracking-tighter ${color} font-mono`}>
            {score}
          </span>
          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mt-0.5">
            {label}
          </span>
        </div>
      </div>

      {/* Range Scale */}
      <div className="flex w-full justify-between items-center px-4 mt-4 text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest font-mono">
        <span>0 (Bear)</span>
        <span>50</span>
        <span>100 (Bull)</span>
      </div>
    </div>
  );
}
