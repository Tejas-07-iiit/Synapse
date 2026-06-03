"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Clock, Activity, Zap } from "lucide-react";
import { useMarketStore } from "@/store/market/useMarketStore";
import { useDashboardStore } from "@/store/dashboard/useDashboardStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useSignalStore } from "@/src/stores/signalStore";
import { PriceChart, ChartMarker, ChartPriceLine } from "./PriceChart";
import { IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts";

// --- TYPES ---
interface TradeOverlay {
  id: string;
  symbol: string;
  direction: "LONG" | "SHORT";
  status: "OPEN" | "CLOSED";
  entryPrice: number;
  tpPrice: number;
  slPrice: number;
  quantity: number;
  pnl: number;
  roi: number;
  openedAt: string;
}

interface ActivePosition {
  id: string;
  symbol: string;
  direction: string;
  entryPrice: number;
  quantity: number;
  stopLoss: number | null;
  takeProfit: number | null;
  openedAt: string;
  auditPayload?: any;
}

// --- TRADING OVERLAY (ZONES) ---
// This component renders the green/red risk/reward boxes.
const TradeZoneOverlay = ({ 
  overlay, 
  chartApi, 
  seriesApi 
}: { 
  overlay: TradeOverlay; 
  chartApi: IChartApi; 
  seriesApi: ISeriesApi<"Candlestick">; 
}) => {
  const [style, setStyle] = useState<React.CSSProperties>({ display: "none" });
  
  const updateStyle = useCallback(() => {
    if (!chartApi || !seriesApi) return;
    
    try {
      const openedAtSeconds = Math.floor(new Date(overlay.openedAt).getTime() / 1000);
      const startXVal = chartApi.timeScale().timeToCoordinate(openedAtSeconds as UTCTimestamp);
      const chartWidth = chartApi.timeScale().width();
      
      if (startXVal === null) {
        setStyle({ display: "none" });
        return;
      }

      const startX = Math.max(0, startXVal);
      const width = Math.max(0, chartWidth - startX);
      
      const entryY = seriesApi.priceToCoordinate(overlay.entryPrice);
      const tpY = seriesApi.priceToCoordinate(overlay.tpPrice);
      const slY = seriesApi.priceToCoordinate(overlay.slPrice);
      
      if (entryY === null || tpY === null || slY === null) {
        setStyle({ display: "none" });
        return;
      }

      const tpTop = Math.min(entryY, tpY);
      const tpHeight = Math.abs(entryY - tpY);
      const slTop = Math.min(entryY, slY);
      const slHeight = Math.abs(entryY - slY);

      setStyle({
        display: "block",
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 10,
        "--startX": `${startX}px`,
        "--width": `${width}px`,
        "--tpTop": `${tpTop}px`,
        "--tpHeight": `${tpHeight}px`,
        "--slTop": `${slTop}px`,
        "--slHeight": `${slHeight}px`,
      } as React.CSSProperties & Record<string, string | number>);
    } catch (e) {
      // Chart is likely disposed
    }
  }, [chartApi, seriesApi, overlay]);

  useEffect(() => {
    try {
      updateStyle();
      const timeScale = chartApi.timeScale();
      timeScale.subscribeVisibleLogicalRangeChange(updateStyle);
      return () => {
        try {
          timeScale.unsubscribeVisibleLogicalRangeChange(updateStyle);
        } catch (e) {
          // Chart disposed
        }
      };
    } catch (e) {
      // Chart disposed
    }
  }, [chartApi, updateStyle]);

  const isLong = overlay.direction === "LONG";
  const tpColor = "rgba(34, 197, 94, 0.12)";
  const slColor = "rgba(239, 68, 68, 0.12)";
  const tpBorder = isLong ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)";
  const slBorder = isLong ? "rgba(239, 68, 68, 0.3)" : "rgba(34, 197, 94, 0.3)";

  return (
    <div style={style}>
      {/* TP Zone */}
      <div 
        className="absolute border-l-2 border-dashed"
        style={{
          top: "var(--tpTop)",
          left: "var(--startX)",
          width: "var(--width)",
          height: "var(--tpHeight)",
          backgroundColor: tpColor,
          borderColor: tpBorder,
        }}
      />
      {/* SL Zone */}
      <div 
        className="absolute border-l-2 border-dashed"
        style={{
          top: "var(--slTop)",
          left: "var(--startX)",
          width: "var(--width)",
          height: "var(--slHeight)",
          backgroundColor: slColor,
          borderColor: slBorder,
        }}
      />
    </div>
  );
};

export default function TradingViewChart() {
  const symbol = useMarketStore((state) => state.symbol);
  const timeframe = useMarketStore((state) => state.timeframe);
  const setTimeframe = useMarketStore((state) => state.setTimeframe);
  const allCandles = useMarketStore((state) => state.allCandles);
  const allIndicators = useMarketStore((state) => state.allIndicators);

  const candles = useMemo(() => {
    const cacheKey = `${symbol.toUpperCase()}_${timeframe.toLowerCase()}`;
    return allCandles[cacheKey] || [];
  }, [symbol, timeframe, allCandles]);

  const indicators = useMemo(() => {
    return allIndicators[symbol.toUpperCase()] || null;
  }, [symbol, allIndicators]);

  const wsStatus = useDashboardStore((state) => state.wsStatus);
  const user = useAuthStore((state) => state.user);
  const tickerData = useMarketStore((state) => state.tickerData);
  const loading = useMarketStore((state) => state.loading);
  const activeSignals = useSignalStore((state) => state.activeSignals);

  const [showEMA, setShowEMA] = useState(true);
  const [showSMA, setShowSMA] = useState(true);
  const [hoverData, setHoverData] = useState<{
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    ema?: number;
    sma?: number;
  } | null>(null);
  const [activePositions, setActivePositions] = useState<ActivePosition[]>([]);
  
  const chartKey = `${symbol}-${timeframe}`;
  
  // APIs for Overlays
  const [apis, setApis] = useState<{ chart: IChartApi; series: ISeriesApi<"Candlestick">; key: string } | null>(null);

  // Helper for unicode strikethrough
  const strikeThrough = (text: string) => {
    return text.split('').map(char => char + '\u0336').join('');
  };

  // Fetch active positions
  useEffect(() => {
    let active = true;
    const fetchPositions = async () => {
      if (!user?.id) return;
      try {
        const res = await fetch(`/api/positions?userId=${user.id}&type=active`);
        const data = await res.json();
        if (active && data.success) {
          setActivePositions(data.positions);
        }
      } catch (err) {
        console.warn("Failed to fetch positions:", err);
      }
    };

    fetchPositions();
    const interval = setInterval(fetchPositions, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [user?.id]);

  // Derive markers and price lines
  const { markers, priceLines, overlays } = useMemo(() => {
    const currentSymbol = symbol.toUpperCase();
    const currentPrice = tickerData[currentSymbol]?.price || (candles.length > 0 ? candles[candles.length - 1].close : 0);
    
    const m: ChartMarker[] = [];
    const p: ChartPriceLine[] = [];
    const o: TradeOverlay[] = [];

    // 1. ACTIVE POSITIONS
    activePositions.forEach((pos) => {
      if (pos.symbol.toUpperCase() !== currentSymbol) return;

      const entryPrice = pos.entryPrice;
      const direction = pos.direction as "LONG" | "SHORT";
      const isLong = direction === "LONG";

      const tpPrice = pos.takeProfit || (isLong ? entryPrice * 1.03 : entryPrice * 0.97);
      const slPrice = pos.stopLoss || (isLong ? entryPrice * 0.985 : entryPrice * 1.015);

      // Determine original values for dynamic strike-through display
      const originalSl = pos.auditPayload?.tradePlan?.stopLoss;
      const originalTp = pos.auditPayload?.tradePlan?.takeProfit;

      let slTitle = "SL";
      if (originalSl && Math.abs(originalSl - slPrice) > 0.0001) {
        slTitle = `SL: ${strikeThrough(originalSl.toFixed(2))} ${slPrice.toFixed(2)}`;
      }

      let tpTitle = "TP";
      if (originalTp && Math.abs(originalTp - tpPrice) > 0.0001) {
        tpTitle = `TP: ${strikeThrough(originalTp.toFixed(2))} ${tpPrice.toFixed(2)}`;
      }

      p.push({
        id: `${pos.id}-entry`,
        price: entryPrice,
        color: "#0ea5e9",
        title: `${direction} ${pos.quantity.toFixed(4)}`,
      });
      p.push({
        id: `${pos.id}-tp`,
        price: tpPrice,
        color: "#22c55e",
        title: tpTitle,
      });
      p.push({
        id: `${pos.id}-sl`,
        price: slPrice,
        color: "#ef4444",
        title: slTitle,
      });

      m.push({
        time: new Date(pos.openedAt).getTime(),
        position: isLong ? "belowBar" : "aboveBar",
        color: isLong ? "#22c55e" : "#ef4444",
        shape: isLong ? "arrowUp" : "arrowDown",
        text: `ENTRY @ ${entryPrice.toLocaleString()}`,
      });

      const pnl = isLong ? (currentPrice - entryPrice) * pos.quantity : (entryPrice - currentPrice) * pos.quantity;
      const roi = (pnl / (entryPrice * pos.quantity)) * 100;

      o.push({
        id: pos.id,
        symbol: pos.symbol,
        direction,
        status: "OPEN",
        entryPrice,
        tpPrice,
        slPrice,
        quantity: pos.quantity,
        pnl,
        roi,
        openedAt: pos.openedAt,
      });
    });

    // 2. AI SIGNALS (Projected Levels)
    // Find the latest signal for this symbol that isn't too old (e.g., within 24h)
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const latestSignal = activeSignals.find(s => 
      s.symbol.toUpperCase() === currentSymbol &&
      (Date.now() - s.timestamp) < ONE_DAY_MS
    );
    const hasActivePosition = activePositions.some(pos => pos.symbol.toUpperCase() === currentSymbol);

    if (latestSignal && !hasActivePosition) {
      const sigType = latestSignal.signalType || latestSignal.signal;
      if (sigType && sigType !== "HOLD") {
        const isLong = sigType === "LONG";
        const color = isLong ? "#00D4FF" : "#FF5252";
        
        p.push({
          id: `signal-${latestSignal.timestamp}-entry`,
          price: latestSignal.entry,
          color: color,
          title: `AI PROJ ENTRY`,
        });
        p.push({
          id: `signal-${latestSignal.timestamp}-tp`,
          price: latestSignal.takeProfit,
          color: "#22c55e",
          title: `AI PROJ TP`,
        });
        p.push({
          id: `signal-${latestSignal.timestamp}-sl`,
          price: latestSignal.stopLoss,
          color: "#ef4444",
          title: `AI PROJ SL`,
        });

        m.push({
          time: latestSignal.timestamp,
          position: isLong ? "belowBar" : "aboveBar",
          color: color,
          shape: isLong ? "arrowUp" : "arrowDown",
          text: `AI ${sigType} (${latestSignal.confidence}%)`,
        });
      }
    }

    return { markers: m, priceLines: p, overlays: o };
  }, [symbol, activePositions, tickerData, candles, activeSignals]);

  const handleCrosshairMove = useCallback((data: {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    ema?: number;
    sma?: number;
  } | null) => {
    setHoverData(data);
  }, []);

  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col h-auto w-full shadow-sm hover:shadow-md transition-all relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[100px] -z-10 pointer-events-none" />
      
      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 shrink-0 z-10">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <h3 className="font-black text-2xl tracking-tighter text-foreground uppercase italic">
                {symbol.replace("USDT", "")}<span className="text-muted-foreground not-italic font-medium text-lg ml-0.5">/USDT</span>
              </h3>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-secondary border border-border">
                <div className={`w-1.5 h-1.5 rounded-full ${wsStatus === "CONNECTED" ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  {wsStatus === "CONNECTED" ? "Live" : "Offline"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Clock size={12} /> {timeframe}
              </span>
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Activity size={12} /> Binance Spot
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Indicator Toggles */}
          <div className="flex items-center bg-secondary p-1 rounded-lg border border-border mr-2">
            <button
              onClick={() => setShowEMA(!showEMA)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold transition-all border ${showEMA ? 'bg-blue-500/10 text-blue-500 border-blue-500/20 shadow-sm' : 'text-muted-foreground border-transparent hover:bg-card-foreground/5'}`}
            >
              EMA
            </button>
            <button
              onClick={() => setShowSMA(!showSMA)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold transition-all border ${showSMA ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20 shadow-sm' : 'text-muted-foreground border-transparent hover:bg-card-foreground/5'}`}
            >
              SMA
            </button>
          </div>

          {/* Timeframe Switcher */}
          <div className="flex bg-secondary p-1 rounded-lg border border-border">
            {["1m", "5m", "15m", "1h", "4h"].map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`text-[10px] font-black px-3 py-1.5 rounded-md transition-all border ${timeframe === tf ? 'bg-card text-foreground shadow border border-border' : 'text-muted-foreground border-transparent hover:text-foreground'}`}
              >
                {tf.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* HUD Panel */}
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-4 mb-4 bg-secondary/40 border border-border rounded-xl p-3 backdrop-blur-md z-10 select-none">
        {[
          { label: "OPEN", val: hoverData?.open, color: "text-foreground" },
          { label: "HIGH", val: hoverData?.high, color: "text-emerald-500" },
          { label: "LOW", val: hoverData?.low, color: "text-rose-500" },
          { label: "CLOSE", val: hoverData?.close, color: "text-foreground" },
          { label: "VOL", val: hoverData?.volume, color: "text-muted-foreground" },
          { label: "EMA", val: hoverData?.ema, color: "text-blue-500", show: showEMA },
          { label: "SMA", val: hoverData?.sma, color: "text-yellow-600", show: showSMA },
        ].filter(i => i.show !== false).map((item) => (
          <div key={item.label} className="flex flex-col gap-0.5">
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter opacity-50">{item.label}</span>
            <span className={`text-[13px] font-black tabular-nums tracking-tight ${item.color}`}>
              {item.val ? (typeof item.val === "number" ? item.val.toLocaleString(undefined, { minimumFractionDigits: 2 }) : item.val) : "—"}
            </span>
          </div>
        ))}
      </div>

      {/* Main Chart Container */}
      <div className="relative w-full h-[600px] rounded-xl border border-border bg-secondary/15 overflow-hidden">
        {loading && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="relative">
              <div className="w-12 h-12 border-2 border-primary/20 rounded-full animate-ping" />
              <Zap className="absolute inset-0 m-auto text-primary animate-pulse" size={24} />
            </div>
            <span className="text-xs font-bold text-foreground mt-4 uppercase tracking-[0.2em] animate-pulse">Synchronizing Market Data</span>
          </div>
        )}
        
        <PriceChart
          key={chartKey} // STABLE RESET PATTERN
          symbol={symbol}
          candles={candles}
          indicators={indicators}
          markers={markers}
          priceLines={priceLines}
          showEMA={showEMA}
          showSMA={showSMA}
          onCrosshairMove={handleCrosshairMove}
          onChartReady={(chart, series) => setApis({ chart, series, key: chartKey })}
        />

        {/* Trade Zone Overlays */}
        {apis && apis.key === chartKey && overlays.map(o => (
          <TradeZoneOverlay 
            key={o.id} 
            overlay={o} 
            chartApi={apis.chart} 
            seriesApi={apis.series} 
          />
        ))}
      </div>
      
      {/* Legend / Footer */}
      <div className="mt-4 flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5"><div className="w-2 h-0.5 bg-blue-500" /> EMA 20</span>
          <span className="flex items-center gap-1.5"><div className="w-2 h-0.5 bg-yellow-500" /> SMA 50</span>
        </div>
        <div>Binance Connectivity: Stable</div>
      </div>
    </div>
  );
}
