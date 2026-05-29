"use client";

import React, { useEffect, useRef } from "react";
import { marketWsService } from "@/src/market-engine/websocket";
import { useMarketStore } from "@/src/stores/marketStore";
import { fetch24hTickers } from "@/services/market/ticker";
import { TickerInfo } from "@/src/strategy-engine/types";
import { marketEngine } from "@/src/market-engine/market-engine";
import { useAuthStore } from "@/store/useAuthStore";

/**
 * Global provider to ensure the WebSocket connection is established once
 * and core coins (BTC, ETH, SOL) are tracked perpetually across all pages.
 */
export const RealtimeProvider = ({ children }: { children: React.ReactNode }) => {
  const isInitialized = useRef(false);
  const supportedSymbols = useMarketStore((state) => state.supportedSymbols);
  const setSupportedSymbols = useMarketStore((state) => state.setSupportedSymbols);
  const selectedSymbol = useMarketStore((state) => state.selectedSymbol);
  const timeframe = useMarketStore((state) => state.timeframe);
  const user = useAuthStore((state) => state.user);
  const authLoading = useAuthStore((state) => state.isLoading);

  // 1. Initialize supported symbols list from environment variables
  useEffect(() => {
    if (supportedSymbols.length === 0) {
      const envCoins = process.env.NEXT_PUBLIC_SUPPORTED_COINS;
      const coinsList = envCoins 
        ? envCoins.split(",").map(c => c.trim().toUpperCase()) 
        : ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
      
      setSupportedSymbols(coinsList);
    }
  }, [supportedSymbols.length, setSupportedSymbols]);

  // 2. Persistent WebSocket connection and core subscriptions
  useEffect(() => {
    if (supportedSymbols.length === 0) return;
    if (isInitialized.current) return;
    
    isInitialized.current = true;

    const startGlobalRealtime = async () => {
      try {
        console.log("[RealtimeProvider] Initializing global market data streams...");
        
        // Fetch initial REST data for all coins to populate immediately
        const initialTickers = await fetch24hTickers(supportedSymbols);
        const store = useMarketStore.getState();
        
        for (const [sym, ticker] of Object.entries(initialTickers)) {
          store.updateTicker(sym, ticker as unknown as TickerInfo);
        }

        // Connect WebSocket
        marketWsService.connect();

        // Core persistent ticker streams (never unsubscribed)
        const coreTickerStreams = supportedSymbols.map((sym) => `${sym.toLowerCase()}@ticker`);
        marketWsService.subscribe(coreTickerStreams);
        
        // Also subscribe to 15m kline for all core symbols to keep indicators warm
        const coreKlineStreams = supportedSymbols.map((sym) => `${sym.toLowerCase()}@kline_15m`);
        marketWsService.subscribe(coreKlineStreams);

        console.log("[RealtimeProvider] Global streams active.");
      } catch (err) {
        console.error("[RealtimeProvider] Failed to initialize global streams:", err);
      }
    };

    startGlobalRealtime();

    // Note: We DO NOT disconnect here on unmount because this provider is at the root level.
    // It should stay alive for the duration of the app session.
  }, [supportedSymbols]);

  // 3. Keep market engine synced with active symbol, timeframe, and auth state
  useEffect(() => {
    if (authLoading) return;
    if (!selectedSymbol || !timeframe) return;

    const startEngine = async () => {
      try {
        await marketEngine.init(selectedSymbol, timeframe);
      } catch (err) {
        console.error("[RealtimeProvider] Failed starting market engine:", err);
      }
    };

    startEngine();
  }, [selectedSymbol, timeframe, authLoading, user?.id]);

  return <>{children}</>;
};

export default RealtimeProvider;
