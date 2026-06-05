"use client";

import React from "react";
import { Loader2 } from "lucide-react";

interface MCXLoaderProps {
  fullscreen?: boolean;
  message?: string;
}

export default function MCXLoader({ fullscreen = true, message = "Loading MCX Data..." }: MCXLoaderProps) {
  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm text-foreground select-none">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <span className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">
            {message}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full py-20 flex flex-col items-center justify-center gap-3 text-foreground select-none">
      <Loader2 className="w-6 h-6 text-primary animate-spin" />
      <span className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase">
        {message}
      </span>
    </div>
  );
}
