"use client";

import React, { useEffect, useRef } from "react";
import { useDashboardStore } from "@/store/dashboard/useDashboardStore";

declare global {
  interface Window {
    TradingView: {
      widget: new (options: Record<string, unknown>) => unknown;
    };
  }
}

export default function TradingViewChart() {
  const selectedSymbol = useDashboardStore((state) => state.selectedSymbol);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let script: HTMLScriptElement | null = null;
    const container = containerRef.current;

    const initWidget = () => {
      if (window.TradingView && container) {
        // Clear previous widget
        container.innerHTML = `<div id="tradingview_widget_container" class="h-full w-full"></div>`;
        
        new window.TradingView.widget({
          autosize: true,
          symbol: `BINANCE:${selectedSymbol}`,
          interval: "60", // Default to 1 hour, user can switch natively inside the widget
          timezone: "Etc/UTC",
          theme: "dark",
          style: "1",
          locale: "en",
          enable_publishing: false,
          hide_side_toolbar: true, // Hide left drawing tools
          allow_symbol_change: false,
          container_id: "tradingview_widget_container",
          studies: [
            "MASimple@tv-basicstudies"
          ],
          disabled_features: [
            "header_indicators",   // Remove indicators button
            "header_compare",      // Remove compare button
            "header_chart_type",    // Remove chart type button
            "header_settings",      // Remove settings button
            "header_screenshot",    // Remove screenshot button
            "header_undo_redo",     // Remove undo/redo buttons
            "left_toolbar",         // Remove left drawing panel
          ]
        });
      }
    };

    if (!window.TradingView) {
      script = document.createElement("script");
      script.src = "https://s3.tradingview.com/tv.js";
      script.type = "text/javascript";
      script.async = true;
      script.onload = initWidget;
      document.head.appendChild(script);
    } else {
      initWidget();
    }

    return () => {
      if (container) {
        container.innerHTML = "";
      }
    };
  }, [selectedSymbol]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-col h-[750px] w-full">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-3">
          <h3 className="font-bold text-white text-lg">{selectedSymbol}</h3>
          <span className="text-xs font-semibold bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded border border-blue-800/40">
            Live Feed
          </span>
        </div>
      </div>
      <div className="flex-1 w-full overflow-hidden rounded relative min-h-[600px]" ref={containerRef}>
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900 text-slate-500">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3"></div>
          <span>Loading TradingView Chart...</span>
        </div>
      </div>
    </div>
  );
}
