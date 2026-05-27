"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { 
  createChart, 
  IChartApi, 
  ISeriesApi, 
  CandlestickData, 
  LineData, 
  HistogramData, 
  UTCTimestamp,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  MouseEventParams,
  createSeriesMarkers
} from "lightweight-charts";
import { useMarketStore } from "@/store/market/useMarketStore";
import { IndicatorValues } from "@/types/market";
import { useTheme } from "next-themes";
import { Eye, EyeOff } from "lucide-react";
import { timezoneEngine } from "@/services/market/timezone";
import { useDashboardStore } from "@/store/dashboard/useDashboardStore";
import { useAuthStore } from "@/store/useAuthStore";

// --- TYPES FOR CHART TRADING OVERLAYS ---
interface TradeOverlay {
  id: string;
  symbol: string;
  direction: "LONG" | "SHORT";
  status: "OPEN" | "CLOSED" | "TP HIT" | "SL HIT";
  entryPrice: number;
  tpPrice: number;
  slPrice: number;
  quantity: number;
  pnl: number;
  roi: number;
  exitPrice?: number;
  closeReason?: string;
  entryY: number | null;
  tpY: number | null;
  slY: number | null;
  currentPriceY: number | null;
  startX: number;
  width: number;
}

interface ActivePosition {
  id: string;
  userId: string;
  symbol: string;
  direction: string;
  entryPrice: number;
  quantity: number;
  stopLoss: number | null;
  takeProfit: number | null;
  leverage: number;
  openedAt: string;
}

interface ClosedTrade {
  id: string;
  symbol: string;
  direction: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  roi: number;
  status: string;
  openedAt: string;
  closedAt: string;
  stopLoss: number | null;
  takeProfit: number | null;
}

// --- TRADINGVIEW POSITION OVERLAY VIEW ---
const TradeOverlayView = ({ overlay, chartWidth }: { overlay: TradeOverlay; chartWidth: number }) => {
  const {
    direction,
    status,
    entryPrice,
    tpPrice,
    slPrice,
    quantity,
    pnl,
    roi,
    entryY,
    tpY,
    slY,
    currentPriceY,
    startX,
    width,
    exitPrice,
    closeReason,
  } = overlay;

  if (entryY === null || tpY === null || slY === null) return null;

  const isLong = direction === "LONG";
  const isOpen = status === "OPEN";

  // Calculate box heights and positions
  const tpBoxTop = Math.min(entryY, tpY);
  const tpBoxHeight = Math.abs(entryY - tpY);
  const slBoxTop = Math.min(entryY, slY);
  const slBoxHeight = Math.abs(entryY - slY);

  // Set colors based on active/historical status
  const entryColor = isOpen ? "#06b6d4" : "#94a3b8"; // Cyan vs Slate
  const tpColor = isOpen ? "#10b981" : "#059669"; // Emerald vs Dark Emerald
  const slColor = isOpen ? "#f43f5e" : "#dc2626"; // Rose vs Red

  // Calculate Risk/Reward ratio
  const riskPct = Math.abs(entryPrice - slPrice) / entryPrice * 100;
  const rewardPct = Math.abs(tpPrice - entryPrice) / entryPrice * 100;
  const rrRatio = riskPct > 0 ? (rewardPct / riskPct).toFixed(2) : "0.00";

  return (
    <div 
      className={`absolute inset-0 pointer-events-none z-20 select-none ${isOpen ? "opacity-100" : "opacity-30 transition-opacity duration-300 hover:opacity-75"}`}
      style={{ width: `${chartWidth}px` }}
    >
      {/* 1. Green Zone (TP Box - Profit Zone) */}
      <div 
        className="absolute border-l"
        style={{
          top: `${tpBoxTop}px`,
          left: `${startX}px`,
          width: `${width}px`,
          height: `${tpBoxHeight}px`,
          backgroundColor: isOpen ? "rgba(16, 185, 129, 0.035)" : "rgba(16, 185, 129, 0.01)",
          borderLeft: `2px ${isOpen ? "solid" : "dashed"} ${isLong ? tpColor : slColor}`,
          borderColor: isLong ? "rgba(16, 185, 129, 0.3)" : "rgba(244, 63, 94, 0.3)",
        }}
      />

      {/* 2. Red Zone (SL Box - Loss Zone) */}
      <div 
        className="absolute border-l"
        style={{
          top: `${slBoxTop}px`,
          left: `${startX}px`,
          width: `${width}px`,
          height: `${slBoxHeight}px`,
          backgroundColor: isOpen ? "rgba(244, 63, 94, 0.035)" : "rgba(244, 63, 94, 0.01)",
          borderLeft: `2px ${isOpen ? "solid" : "dashed"} ${isLong ? slColor : tpColor}`,
          borderColor: isLong ? "rgba(244, 63, 94, 0.3)" : "rgba(16, 185, 129, 0.3)",
        }}
      />

      {/* 3. Entry Line */}
      <div 
        className="absolute flex items-center"
        style={{
          top: `${entryY}px`,
          left: `${startX}px`,
          width: `${width}px`,
          borderTop: `1.5px dashed ${entryColor}`,
        }}
      >
        <div 
          className="bg-cyan-950/95 text-cyan-400 border border-cyan-500/30 text-[9px] font-black px-2 py-0.5 rounded-r-md uppercase flex items-center gap-1.5 shadow-md -translate-y-1/2 select-none"
          style={{ borderColor: `${entryColor}40`, color: entryColor }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entryColor }}></span>
          {direction} {quantity.toFixed(4)} @ ${entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </div>
      </div>

      {/* 4. Take Profit Line */}
      <div 
        className="absolute flex items-center"
        style={{
          top: `${tpY}px`,
          left: `${startX}px`,
          width: `${width}px`,
          borderTop: `1.5px ${isOpen ? "solid" : "dashed"} ${isLong ? tpColor : slColor}`,
        }}
      >
        <div 
          className="bg-emerald-950/95 text-emerald-400 border border-emerald-500/30 text-[9px] font-black px-2 py-0.5 rounded-r-md uppercase flex items-center gap-1.5 shadow-md -translate-y-1/2 select-none"
          style={{
            borderColor: isLong ? `${tpColor}35` : `${slColor}35`,
            color: isLong ? tpColor : slColor,
          }}
        >
          TP: ${tpPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          {isOpen && ` | Target: +$${(Math.abs(tpPrice - entryPrice) * quantity).toFixed(2)} (+${rewardPct.toFixed(2)}%)`}
        </div>
      </div>

      {/* 5. Stop Loss Line */}
      <div 
        className="absolute flex items-center"
        style={{
          top: `${slY}px`,
          left: `${startX}px`,
          width: `${width}px`,
          borderTop: `1.5px ${isOpen ? "solid" : "dashed"} ${isLong ? slColor : tpColor}`,
        }}
      >
        <div 
          className="bg-rose-950/95 text-rose-400 border border-rose-500/30 text-[9px] font-black px-2 py-0.5 rounded-r-md uppercase flex items-center gap-1.5 shadow-md -translate-y-1/2 select-none"
          style={{
            borderColor: isLong ? `${slColor}35` : `${tpColor}35`,
            color: isLong ? slColor : tpColor,
          }}
        >
          SL: ${slPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          {isOpen && ` | Risk: -$${(Math.abs(entryPrice - slPrice) * quantity).toFixed(2)} (-${riskPct.toFixed(2)}%)`}
        </div>
      </div>

      {/* 6. Live HUD Label (Floating PNL & Status Tag) */}
      <div 
        className="absolute"
        style={{
          top: `${isOpen ? currentPriceY : entryY}px`,
          left: `${startX + Math.max(10, width - 240)}px`,
          transform: "translateY(-100%)",
        }}
      >
        <div 
          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[9px] font-black tracking-tight border uppercase shadow-xl ${
            !isOpen
              ? "bg-secondary/90 text-muted-foreground border-border"
              : pnl >= 0
              ? "bg-emerald-950/95 text-emerald-400 border-emerald-500/35 shadow-emerald-500/5"
              : "bg-rose-950/95 text-rose-400 border-rose-500/35 shadow-rose-500/5"
          }`}
        >
          {/* Position Badge Status */}
          <span 
            className={`px-1.5 py-0.5 rounded text-[8px] font-black tracking-wider ${
              !isOpen
                ? "bg-muted text-muted-foreground"
                : isLong
                ? "bg-emerald-500/20 text-emerald-300"
                : "bg-rose-500/20 text-rose-300"
            }`}
          >
            {status}
          </span>
          
          {/* PnL Value */}
          <span className="font-extrabold font-mono text-sm leading-none">
            {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)} ({pnl >= 0 ? "+" : ""}{roi.toFixed(2)}%)
          </span>

          {/* Risk Reward Badge */}
          {isOpen && (
            <span className="text-[8px] text-muted-foreground/80 font-semibold tracking-wider">
              (R:R {rrRatio})
            </span>
          )}

          {/* Historical Details */}
          {!isOpen && (
            <span className="text-[8px] text-muted-foreground font-normal normal-case">
              Exit: ${exitPrice?.toLocaleString()} ({closeReason})
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

interface HoverData {
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  ema: string;
  sma: string;
  bbUpper: string;
  bbMiddle: string;
  bbLower: string;
  rsi: string;
  macd: string;
  macdSig: string;
  macdHist: string;
}

export default function TradingViewChart() {
  const symbol = useMarketStore((state) => state.symbol);
  const candles = useMarketStore((state) => state.candles);
  const indicators = useMarketStore((state) => state.indicators);
  const timeframe = useMarketStore((state) => state.timeframe);
  const setTimeframe = useMarketStore((state) => state.setTimeframe);
  const loading = useMarketStore((state) => state.loading);
  const tickerData = useMarketStore((state) => state.tickerData);

  const wsStatus = useDashboardStore((state) => state.wsStatus);
  const user = useAuthStore((state) => state.user);

  const { resolvedTheme } = useTheme();

  // Overlay Visibility Toggles (initially false/turned off)
  const [showEMA, setShowEMA] = useState(false);
  const [showSMA, setShowSMA] = useState(false);
  const [showBB, setShowBB] = useState(false);

  // Trade Events state for executions markers
  interface TradeEvent {
    time: number;
    type: "BUY" | "SELL";
    price: number;
  }
  const [tradeEvents, setTradeEvents] = useState<TradeEvent[]>([]);

  // Dynamic Hover HUD State
  const [hoverData, setHoverData] = useState<HoverData | null>(null);
  const isHoveringRef = useRef(false);
  const [chartReady, setChartReady] = useState(false);
  const [activePositions, setActivePositions] = useState<ActivePosition[]>([]);
  const [closedTrades, setClosedTrades] = useState<ClosedTrade[]>([]);
  const [overlays, setOverlays] = useState<TradeOverlay[]>([]);
  const [clientWidth, setClientWidth] = useState(0);
  const [timeScaleTrigger, setTimeScaleTrigger] = useState(0);

  // DOM Refs
  const mainChartRef = useRef<HTMLDivElement>(null);
  const rsiChartRef = useRef<HTMLDivElement>(null);
  const macdChartRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Chart Instances
  const chart1Ref = useRef<IChartApi | null>(null);
  const chart2Ref = useRef<IChartApi | null>(null);
  const chart3Ref = useRef<IChartApi | null>(null);

  // Series Instances
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const emaSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const smaSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbUpperSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbMiddleSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbLowerSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const volumeMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  const rsiSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  
  const macdLineSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdSignalSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdHistSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const dummySeries2Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const dummySeries3Ref = useRef<ISeriesApi<"Line"> | null>(null);

  // Previous states to distinguish full reload vs update
  const prevSymbolRef = useRef<string>("");
  const prevTimeframeRef = useRef<string>("");
  const prevCandlesLengthRef = useRef<number>(0);
  const prevShowEMARef = useRef<boolean>(false);
  const prevShowSMARef = useRef<boolean>(false);
  const prevShowBBRef = useRef<boolean>(false);
  const isSyncingRef = useRef<boolean>(false);
  const prevIndicatorsRef = useRef<IndicatorValues | null>(null);
  const prevThemeRef = useRef<string | undefined>(resolvedTheme);
  const lastChartTimeRef = useRef<number | null>(null);

  // Data refs to prevent stale closures in event listeners without chart recreation
  const candlesRef = useRef(candles);
  const indicatorsRef = useRef(indicators);

  // Sync data refs on every render
  candlesRef.current = candles;
  indicatorsRef.current = indicators;

  // Helper to format values for the HUD
  const getFormat = (val: number | undefined, decimals = 2) => {
    if (val === undefined || val === null || isNaN(val)) return "—";
    return val.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  // Helper to set HUD values to the latest candle
  const updateHoverWithLatest = useCallback(() => {
    const currentCandles = candlesRef.current;
    const currentIndicators = indicatorsRef.current;
    if (currentCandles.length === 0) {
      setHoverData(null);
      return;
    }
    const lastIdx = currentCandles.length - 1;
    const c = currentCandles[lastIdx];
    setHoverData({
      open: getFormat(c.open),
      high: getFormat(c.high),
      low: getFormat(c.low),
      close: getFormat(c.close),
      volume: getFormat(c.volume, 0),
      ema: getFormat(currentIndicators?.ema20?.[lastIdx]),
      sma: getFormat(currentIndicators?.sma50?.[lastIdx]),
      bbUpper: getFormat(currentIndicators?.bbUpper?.[lastIdx]),
      bbMiddle: getFormat(currentIndicators?.bbMiddle?.[lastIdx]),
      bbLower: getFormat(currentIndicators?.bbLower?.[lastIdx]),
      rsi: getFormat(currentIndicators?.rsi?.[lastIdx]),
      macd: getFormat(currentIndicators?.macdLine?.[lastIdx], 4),
      macdSig: getFormat(currentIndicators?.signalLine?.[lastIdx], 4),
      macdHist: getFormat(currentIndicators?.macdHist?.[lastIdx], 4),
    });
  }, []);

  // Update default hover view on indicators/candles change
  useEffect(() => {
    if (!isHoveringRef.current) {
      updateHoverWithLatest();
    }
  }, [candles, indicators, updateHoverWithLatest]);

  useEffect(() => {
    let active = true;
    const fetchTrades = async () => {
      if (!user?.id) {
        setTradeEvents([]);
        return;
      }
      try {
        const [activeRes, closedRes] = await Promise.all([
          fetch(`/api/positions?userId=${user.id}&type=active`),
          fetch(`/api/positions?userId=${user.id}&type=closed`),
        ]);
        const activeData = await activeRes.json();
        const closedData = await closedRes.json();

        if (!active) return;

        const events: TradeEvent[] = [];
        const currentSymbol = symbol.toUpperCase();

        interface PositionResponse {
          symbol: string;
          openedAt: string;
          direction: string;
          entryPrice: number;
        }

        interface TradeResponse {
          symbol: string;
          openedAt: string;
          closedAt: string;
          direction: string;
          entryPrice: number;
          exitPrice: number;
        }

        if (activeData.success && Array.isArray(activeData.positions)) {
          setActivePositions(activeData.positions);
          activeData.positions
            .filter((p: PositionResponse) => p.symbol.toUpperCase() === currentSymbol)
            .forEach((p: PositionResponse) => {
              events.push({
                time: new Date(p.openedAt).getTime(),
                type: p.direction === "LONG" ? "BUY" : "SELL",
                price: p.entryPrice,
              });
            });
        } else {
          setActivePositions([]);
        }

        if (closedData.success && Array.isArray(closedData.trades)) {
          setClosedTrades(closedData.trades);
          closedData.trades
            .filter((t: TradeResponse) => t.symbol.toUpperCase() === currentSymbol)
            .forEach((t: TradeResponse) => {
              // Entry
              events.push({
                time: new Date(t.openedAt).getTime(),
                type: t.direction === "LONG" ? "BUY" : "SELL",
                price: t.entryPrice,
              });
              // Exit
              events.push({
                time: new Date(t.closedAt).getTime(),
                type: t.direction === "LONG" ? "SELL" : "BUY",
                price: t.exitPrice,
              });
            });
        } else {
          setClosedTrades([]);
        }

        // Sort events by time
        events.sort((a, b) => a.time - b.time);
        setTradeEvents(events);
      } catch (err) {
        console.error("[Chart] Failed to fetch trade events for markers:", err);
      }
    };

    fetchTrades();
    const interval = setInterval(fetchTrades, 5000); // refresh every 5 seconds

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [symbol, user?.id]);

  // Synchronize timescale updates (zoom/scroll) to force React overlay recalculation
  useEffect(() => {
    if (!chartReady || !chart1Ref.current) return;

    const handleTimeScaleChange = () => {
      setTimeScaleTrigger((prev) => prev + 1);
    };

    chart1Ref.current.timeScale().subscribeVisibleLogicalRangeChange(handleTimeScaleChange);
    chart1Ref.current.timeScale().subscribeVisibleTimeRangeChange(handleTimeScaleChange);

    return () => {
      if (chart1Ref.current) {
        chart1Ref.current.timeScale().unsubscribeVisibleLogicalRangeChange(handleTimeScaleChange);
        chart1Ref.current.timeScale().unsubscribeVisibleTimeRangeChange(handleTimeScaleChange);
      }
    };
  }, [chartReady]);

  const livePrice = tickerData[symbol.toUpperCase()]?.price;

  // Recalculate overlay Y and X coordinates
  const updateOverlays = useCallback(() => {
    if (!chartReady || !chart1Ref.current || !candleSeriesRef.current || !mainChartRef.current || clientWidth === 0) return;

    // Reference dependencies to satisfy React Hook ESLint rules
    void livePrice;
    void timeScaleTrigger;

    const currentSymbol = symbol.toUpperCase();
    const currentPrice = tickerData[currentSymbol]?.price || (candles.length > 0 ? candles[candles.length - 1].close : 0);
    const rightOffset = 90; // width of price scale
    const chartWidth = clientWidth - rightOffset;

    const newOverlays: TradeOverlay[] = [];

    // 1. Active Positions
    activePositions.forEach((pos) => {
      if (pos.symbol.toUpperCase() !== currentSymbol) return;

      const entryPrice = pos.entryPrice;
      const tpPrice = pos.takeProfit || (pos.direction === "LONG" ? entryPrice * 1.03 : entryPrice * 0.97);
      const slPrice = pos.stopLoss || (pos.direction === "LONG" ? entryPrice * 0.985 : entryPrice * 1.015);
      const qty = pos.quantity;
      const direction = pos.direction as "LONG" | "SHORT";

      // Floating PnL
      let pnl = 0;
      if (direction === "LONG") {
        pnl = (currentPrice - entryPrice) * qty;
      } else {
        pnl = (entryPrice - currentPrice) * qty;
      }
      const roi = (pnl / (entryPrice * qty)) * 100;

      // Coordinate projections
      const entryY = candleSeriesRef.current!.priceToCoordinate(entryPrice);
      const tpY = candleSeriesRef.current!.priceToCoordinate(tpPrice);
      const slY = candleSeriesRef.current!.priceToCoordinate(slPrice);
      const currentPriceY = candleSeriesRef.current!.priceToCoordinate(currentPrice);

      const openedAtSeconds = Math.floor(new Date(pos.openedAt).getTime() / 1000);
      const startXVal = chart1Ref.current!.timeScale().timeToCoordinate(openedAtSeconds as UTCTimestamp);
      
      let startX = startXVal !== null ? startXVal : 0;
      if (startX < 0) startX = 0;
      if (startX > chartWidth) startX = chartWidth;

      const width = chartWidth - startX;

      newOverlays.push({
        id: pos.id,
        symbol: pos.symbol,
        direction,
        status: "OPEN",
        entryPrice,
        tpPrice,
        slPrice,
        quantity: qty,
        pnl,
        roi,
        entryY,
        tpY,
        slY,
        currentPriceY,
        startX,
        width: width > 0 ? width : 0,
      });
    });

    // 2. Closed Trades
    const recentClosed = [...closedTrades]
      .filter((t) => t.symbol.toUpperCase() === currentSymbol)
      .slice(0, 5);

    recentClosed.forEach((t) => {
      const entryPrice = t.entryPrice;
      const tpPrice = t.takeProfit || entryPrice;
      const slPrice = t.stopLoss || entryPrice;
      const qty = t.quantity || 0;
      const direction = t.direction as "LONG" | "SHORT";
      const exitPrice = t.exitPrice;
      const pnl = t.pnl;
      const roi = t.roi;
      const status = t.status as string;
      
      const openedAtSeconds = Math.floor(new Date(t.openedAt).getTime() / 1000);
      const closedAtSeconds = Math.floor(new Date(t.closedAt).getTime() / 1000);

      const entryY = candleSeriesRef.current!.priceToCoordinate(entryPrice);
      const tpY = candleSeriesRef.current!.priceToCoordinate(tpPrice);
      const slY = candleSeriesRef.current!.priceToCoordinate(slPrice);
      const exitY = candleSeriesRef.current!.priceToCoordinate(exitPrice);

      const startXVal = chart1Ref.current!.timeScale().timeToCoordinate(openedAtSeconds as UTCTimestamp);
      const endXVal = chart1Ref.current!.timeScale().timeToCoordinate(closedAtSeconds as UTCTimestamp);

      if (startXVal === null && endXVal === null) return; // not visible

      let startX = startXVal !== null ? startXVal : 0;
      let endX = endXVal !== null ? endXVal : chartWidth;

      if (startX < 0) startX = 0;
      if (startX > chartWidth) startX = chartWidth;
      if (endX < 0) endX = 0;
      if (endX > chartWidth) endX = chartWidth;

      const width = endX - startX;

      let statusBadge: "OPEN" | "CLOSED" | "TP HIT" | "SL HIT" = "CLOSED";
      if (status === "STOPPED" || status === "STOP LOSS" || status === "SL HIT") {
        statusBadge = "SL HIT";
      } else if (status === "TP HIT" || status === "TAKE PROFIT") {
        statusBadge = "TP HIT";
      }

      newOverlays.push({
        id: t.id || Math.random().toString(),
        symbol: t.symbol,
        direction,
        status: statusBadge,
        entryPrice,
        tpPrice,
        slPrice,
        quantity: qty,
        pnl,
        roi,
        exitPrice,
        closeReason: statusBadge === "SL HIT" ? "STOP LOSS" : statusBadge === "TP HIT" ? "TAKE PROFIT" : "MANUAL",
        entryY,
        tpY,
        slY,
        currentPriceY: exitY,
        startX,
        width: width > 0 ? width : 0,
      });
    });

    setOverlays(newOverlays);
  }, [chartReady, symbol, activePositions, closedTrades, candles, clientWidth, timeScaleTrigger, livePrice, tickerData]);

  useEffect(() => {
    updateOverlays();
  }, [updateOverlays]);

  useEffect(() => {
    if (!mainChartRef.current || !rsiChartRef.current || !macdChartRef.current) return;

    // Theme values
    const isDark = resolvedTheme === "dark";
    const colors = {
      bg: isDark ? "#0c0c0e" : "#ffffff", // Matches --card in globals.css
      text: isDark ? "#a1a1aa" : "#64748b", // Matches --muted-foreground
      grid: isDark ? "#18181b" : "#f1f5f9", // Matches --border / --muted
      border: isDark ? "#18181b" : "#e2e8f0", // Matches --border
      upColor: "#22c55e",
      downColor: "#ef4444",
      upVolume: "rgba(34, 197, 94, 0.25)",
      downVolume: "rgba(239, 68, 68, 0.25)",
    };

    // 1. Create Main Price + Volume Chart (Chart 1)
    const chart1 = createChart(mainChartRef.current, {
      layout: {
        background: { color: colors.bg },
        textColor: colors.text,
      },
      grid: {
        vertLines: { color: colors.grid },
        horzLines: { color: colors.grid },
      },
      timeScale: {
        visible: true, // Visible right below the main graph
        borderVisible: true,
        borderColor: colors.border,
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderVisible: true,
        borderColor: colors.border,
        minimumWidth: 90,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
      width: mainChartRef.current.clientWidth,
      height: 600,
    });
    chart1Ref.current = chart1;

    // Add main price series
    const candleSeries = chart1.addSeries(CandlestickSeries, {
      upColor: colors.upColor,
      downColor: colors.downColor,
      borderUpColor: colors.upColor,
      borderDownColor: colors.downColor,
      wickUpColor: colors.upColor,
      wickDownColor: colors.downColor,
    });
    candleSeriesRef.current = candleSeries;

    // Add overlays (EMA, SMA, BB)
    const emaSeries = chart1.addSeries(LineSeries, {
      color: "#3b82f6", // Blue
      lineWidth: 2,
      title: "EMA (20)",
    });
    emaSeriesRef.current = emaSeries;

    const smaSeries = chart1.addSeries(LineSeries, {
      color: "#eab308", // Yellow
      lineWidth: 2,
      title: "SMA (50)",
    });
    smaSeriesRef.current = smaSeries;

    const bbUpperSeries = chart1.addSeries(LineSeries, {
      color: "rgba(168, 85, 247, 0.6)", // Purple
      lineWidth: 1,
      lineStyle: 2, // Dashed
      title: "BB Upper",
    });
    bbUpperSeriesRef.current = bbUpperSeries;

    const bbMiddleSeries = chart1.addSeries(LineSeries, {
      color: "rgba(168, 85, 247, 0.4)",
      lineWidth: 1,
      lineStyle: 2,
      title: "BB Basis",
    });
    bbMiddleSeriesRef.current = bbMiddleSeries;

    const bbLowerSeries = chart1.addSeries(LineSeries, {
      color: "rgba(168, 85, 247, 0.6)",
      lineWidth: 1,
      lineStyle: 2,
      title: "BB Lower",
    });
    bbLowerSeriesRef.current = bbLowerSeries;

    // Add Volume series on the main chart (using separate y-axis overlays)
    const volumeSeries = chart1.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume-scale",
    });
    chart1.priceScale("volume-scale").applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });
    volumeSeriesRef.current = volumeSeries;

    // Add Volume Moving Average (plotted over the volume scale)
    const volumeMASeries = chart1.addSeries(LineSeries, {
      color: "rgba(148, 163, 184, 0.4)",
      lineWidth: 1,
      priceScaleId: "volume-scale",
    });
    volumeMASeriesRef.current = volumeMASeries;
    
    chart1.priceScale("right").applyOptions({
      autoScale: true,
      alignLabels: true,
    });

    // 2. Create RSI Chart (Chart 2)
    const chart2 = createChart(rsiChartRef.current, {
      layout: {
        background: { color: colors.bg },
        textColor: colors.text,
      },
      grid: {
        vertLines: { color: colors.grid },
        horzLines: { color: colors.grid },
      },
      timeScale: {
        visible: false,
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderVisible: true,
        borderColor: colors.border,
        minimumWidth: 90,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
      width: rsiChartRef.current.clientWidth,
      height: 120,
    });
    chart2Ref.current = chart2;

    const dummySeries2 = chart2.addSeries(LineSeries, {
      color: "rgba(0, 0, 0, 0)",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    dummySeries2Ref.current = dummySeries2;

    const rsiSeries = chart2.addSeries(LineSeries, {
      color: "#a855f7", // Purple
      lineWidth: 2,
      title: "RSI (14)",
    });
    rsiSeries.createPriceLine({
      price: 70,
      color: "rgba(239, 68, 68, 0.4)",
      lineWidth: 1,
      lineStyle: 3,
      axisLabelVisible: true,
      title: "Overbought",
    });
    rsiSeries.createPriceLine({
      price: 50,
      color: "rgba(148, 163, 184, 0.25)",
      lineWidth: 1,
      lineStyle: 3,
      axisLabelVisible: false,
    });
    rsiSeries.createPriceLine({
      price: 30,
      color: "rgba(34, 197, 94, 0.4)",
      lineWidth: 1,
      lineStyle: 3,
      axisLabelVisible: true,
      title: "Oversold",
    });
    chart2.priceScale("right").applyOptions({
      scaleMargins: {
        top: 0.1,
        bottom: 0.1,
      },
    });
    rsiSeriesRef.current = rsiSeries;

    // 3. Create MACD Chart (Chart 3)
    const chart3 = createChart(macdChartRef.current, {
      layout: {
        background: { color: colors.bg },
        textColor: colors.text,
      },
      grid: {
        vertLines: { color: colors.grid },
        horzLines: { color: colors.grid },
      },
      timeScale: {
        visible: true, // Visible at the bottom chart
        borderVisible: true,
        borderColor: colors.border,
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderVisible: true,
        borderColor: colors.border,
        minimumWidth: 90,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
      width: macdChartRef.current.clientWidth,
      height: 140,
    });
    chart3Ref.current = chart3;

    const dummySeries3 = chart3.addSeries(LineSeries, {
      color: "rgba(0, 0, 0, 0)",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    dummySeries3Ref.current = dummySeries3;

    const macdLineSeries = chart3.addSeries(LineSeries, {
      color: "#3b82f6", // Blue MACD line
      lineWidth: 1,
      title: "MACD",
    });
    macdLineSeriesRef.current = macdLineSeries;

    const macdSignalSeries = chart3.addSeries(LineSeries, {
      color: "#f43f5e", // Pink Signal line
      lineWidth: 1,
      title: "Signal",
    });
    macdSignalSeriesRef.current = macdSignalSeries;

    const macdHistSeries = chart3.addSeries(HistogramSeries, {
      title: "Histogram",
    });
    macdHistSeriesRef.current = macdHistSeries;

    // --- TIMELINE SYNC ROUTINES ---
    let isSyncing = false;
    const syncTimeScale = (sourceChart: IChartApi, targets: IChartApi[]) => {
      sourceChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (isSyncing || isSyncingRef.current || !range) return;
        
        isSyncing = true;
        targets.forEach((target) => {
          try {
            const targetRange = target.timeScale().getVisibleLogicalRange();
            if (targetRange) {
              const diffFrom = Math.abs(targetRange.from - range.from);
              const diffTo = Math.abs(targetRange.to - range.to);
              if (diffFrom > 0.01 || diffTo > 0.01) {
                target.timeScale().setVisibleLogicalRange(range);
              }
            }
          } catch {
            // Ignore if chart is not fully initialized yet
          }
        });
        isSyncing = false;
      });
    };

    syncTimeScale(chart1, [chart2, chart3]);
    syncTimeScale(chart2, [chart1, chart3]);
    syncTimeScale(chart3, [chart1, chart2]);

    // --- REALTIME HOVER HUD INTERACTION ---
    const handleCrosshairMove = (param: MouseEventParams) => {
      const currentCandles = candlesRef.current;
      const currentIndicators = indicatorsRef.current;

      if (!param.time) {
        isHoveringRef.current = false;
        updateHoverWithLatest();
        return;
      }

      isHoveringRef.current = true;
      const utcTimeMs = timezoneEngine.localToUtc((param.time as number) * 1000);
      const idx = currentCandles.findIndex((c) => Math.abs(c.time - utcTimeMs) < 1000);
      if (idx === -1) return;

      const c = currentCandles[idx];
      setHoverData({
        open: getFormat(c.open),
        high: getFormat(c.high),
        low: getFormat(c.low),
        close: getFormat(c.close),
        volume: getFormat(c.volume, 0),
        ema: getFormat(currentIndicators?.ema20?.[idx]),
        sma: getFormat(currentIndicators?.sma50?.[idx]),
        bbUpper: getFormat(currentIndicators?.bbUpper?.[idx]),
        bbMiddle: getFormat(currentIndicators?.bbMiddle?.[idx]),
        bbLower: getFormat(currentIndicators?.bbLower?.[idx]),
        rsi: getFormat(currentIndicators?.rsi?.[idx]),
        macd: getFormat(currentIndicators?.macdLine?.[idx], 4),
        macdSig: getFormat(currentIndicators?.signalLine?.[idx], 4),
        macdHist: getFormat(currentIndicators?.macdHist?.[idx], 4),
      });
    };

    chart1.subscribeCrosshairMove(handleCrosshairMove);
    chart2.subscribeCrosshairMove(handleCrosshairMove);
    chart3.subscribeCrosshairMove(handleCrosshairMove);

    // --- RESPONSIVE RESIZING WITH RESIZEOBSERVER ---
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width } = entries[0].contentRect;
      if (width > 0) {
        chart1.resize(width, 600);
        chart2.resize(width, 120);
        chart3.resize(width, 140);
        setClientWidth(width);
      }
    });

    if (mainChartRef.current) {
      setClientWidth(mainChartRef.current.clientWidth);
      resizeObserver.observe(mainChartRef.current);
    }

    setChartReady(true);

    return () => {
      setChartReady(false);
      lastChartTimeRef.current = null;
      resizeObserver.disconnect();

      chart1.unsubscribeCrosshairMove(handleCrosshairMove);
      chart2.unsubscribeCrosshairMove(handleCrosshairMove);
      chart3.unsubscribeCrosshairMove(handleCrosshairMove);

      chart1.remove();
      chart2.remove();
      chart3.remove();
    };
  }, [resolvedTheme, updateHoverWithLatest, symbol, timeframe]);

  // Feed/Sync Data to Chart series
  useEffect(() => {
    if (!chartReady || candles.length === 0 || !candleSeriesRef.current) return;

    isSyncingRef.current = true;

    // Create a copy of candles and sort by time (ascending) to prevent lightweight-charts errors
    const sortedCandles = [...candles].sort((a, b) => a.time - b.time);

    const isNewSymbolOrTimeframe = 
      symbol !== prevSymbolRef.current || 
      timeframe !== prevTimeframeRef.current;

    const isThemeChanged = resolvedTheme !== prevThemeRef.current;

    const isVisibilityToggled = 
      showEMA !== prevShowEMARef.current ||
      showSMA !== prevShowSMARef.current ||
      showBB !== prevShowBBRef.current;

    const isIndicatorsLoaded = !prevIndicatorsRef.current && !!indicators;

    const isFullReload = 
      isNewSymbolOrTimeframe || 
      isThemeChanged ||
      isVisibilityToggled ||
      isIndicatorsLoaded ||
      sortedCandles.length < prevCandlesLengthRef.current || 
      Math.abs(sortedCandles.length - prevCandlesLengthRef.current) > 1;

    // Update refs for the next run
    prevSymbolRef.current = symbol;
    prevTimeframeRef.current = timeframe;
    prevThemeRef.current = resolvedTheme;
    prevCandlesLengthRef.current = sortedCandles.length;
    prevShowEMARef.current = showEMA;
    prevShowSMARef.current = showSMA;
    prevShowBBRef.current = showBB;
    prevIndicatorsRef.current = indicators;

    const createLineData = (arr: number[]): LineData[] => {
      const result: LineData[] = [];
      for (let idx = 0; idx < arr.length; idx++) {
        const val = arr[idx];
        if (val !== undefined && !isNaN(val) && sortedCandles[idx]) {
          result.push({
            time: (timezoneEngine.utcToLocal(sortedCandles[idx].time) / 1000) as UTCTimestamp,
            value: val,
          });
        }
      }
      return result;
    };

    const createHistData = (arr: number[]): HistogramData[] => {
      const result: HistogramData[] = [];
      for (let idx = 0; idx < arr.length; idx++) {
        const val = arr[idx];
        if (val !== undefined && !isNaN(val) && sortedCandles[idx]) {
          result.push({
            time: (timezoneEngine.utcToLocal(sortedCandles[idx].time) / 1000) as UTCTimestamp,
            value: val,
            color: val >= 0 ? "rgba(34, 197, 94, 0.45)" : "rgba(239, 68, 68, 0.45)",
          });
        }
      }
      return result;
    };

    try {
      if (isFullReload) {
        // 1. Full reload using setData()
        const dummyData2: LineData[] = sortedCandles.map((c) => ({
          time: (timezoneEngine.utcToLocal(c.time) / 1000) as UTCTimestamp,
          value: 50,
        }));
        const dummyData3: LineData[] = sortedCandles.map((c) => ({
          time: (timezoneEngine.utcToLocal(c.time) / 1000) as UTCTimestamp,
          value: 0,
        }));

        if (dummySeries2Ref.current) {
          dummySeries2Ref.current.setData(dummyData2);
        }
        if (dummySeries3Ref.current) {
          dummySeries3Ref.current.setData(dummyData3);
        }

        const candleData: CandlestickData[] = sortedCandles.map((c) => ({
          time: (timezoneEngine.utcToLocal(c.time) / 1000) as UTCTimestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }));

        const volumeData: HistogramData[] = sortedCandles.map((c) => {
          const isUp = c.close >= c.open;
          return {
            time: (timezoneEngine.utcToLocal(c.time) / 1000) as UTCTimestamp,
            value: c.volume,
            color: isUp ? "rgba(34, 197, 94, 0.25)" : "rgba(239, 68, 68, 0.25)",
          };
        });

        candleSeriesRef.current.setData(candleData);
        if (volumeSeriesRef.current) {
          volumeSeriesRef.current.setData(volumeData);
        }

        const lastCandle = sortedCandles[sortedCandles.length - 1];
        if (lastCandle) {
          lastChartTimeRef.current = timezoneEngine.utcToLocal(lastCandle.time) / 1000;
        }

        if (!indicators) return;

        // Plot EMA(20)
        if (emaSeriesRef.current) {
          if (showEMA && indicators.ema20) {
            emaSeriesRef.current.setData(createLineData(indicators.ema20));
          } else {
            emaSeriesRef.current.setData([]);
          }
        }

        // Plot SMA(50)
        if (smaSeriesRef.current) {
          if (showSMA && indicators.sma50) {
            smaSeriesRef.current.setData(createLineData(indicators.sma50));
          } else {
            smaSeriesRef.current.setData([]);
          }
        }

        // Plot Bollinger bands
        if (bbUpperSeriesRef.current && bbMiddleSeriesRef.current && bbLowerSeriesRef.current) {
          if (showBB && indicators.bbUpper && indicators.bbMiddle && indicators.bbLower) {
            bbUpperSeriesRef.current.setData(createLineData(indicators.bbUpper));
            bbMiddleSeriesRef.current.setData(createLineData(indicators.bbMiddle));
            bbLowerSeriesRef.current.setData(createLineData(indicators.bbLower));
          } else {
            bbUpperSeriesRef.current.setData([]);
            bbMiddleSeriesRef.current.setData([]);
            bbLowerSeriesRef.current.setData([]);
          }
        }

        // Plot Volume MA
        if (volumeMASeriesRef.current && indicators.volumeMA) {
          volumeMASeriesRef.current.setData(createLineData(indicators.volumeMA));
        }

        // Plot RSI
        if (rsiSeriesRef.current && indicators.rsi) {
          rsiSeriesRef.current.setData(createLineData(indicators.rsi));
        }

        // Plot MACD
        if (macdLineSeriesRef.current && indicators.macdLine) {
          macdLineSeriesRef.current.setData(createLineData(indicators.macdLine));
        }
        if (macdSignalSeriesRef.current && indicators.signalLine) {
          macdSignalSeriesRef.current.setData(createLineData(indicators.signalLine));
        }
        if (macdHistSeriesRef.current && indicators.macdHist) {
          macdHistSeriesRef.current.setData(createHistData(indicators.macdHist));
        }

        // Autoscale and fit content on symbol/timeframe load to prevent compressed/cut off candles
        if (chart1Ref.current) {
          chart1Ref.current.timeScale().fitContent();
        }
      } else {
        // 2. Incremental real-time updates using update()
        const lastCandle = sortedCandles[sortedCandles.length - 1];
        const timeVal = (timezoneEngine.utcToLocal(lastCandle.time) / 1000) as UTCTimestamp;

        // Skip updates if the new timestamp is strictly older than the last update timestamp to prevent lightweight-charts crash
        if (lastChartTimeRef.current !== null && (timeVal as number) < lastChartTimeRef.current) {
          console.warn(`[Chart] Ignoring older tick timestamp: ${timeVal} < ${lastChartTimeRef.current}`);
          return;
        }

        lastChartTimeRef.current = timeVal as number;

        try {
          if (dummySeries2Ref.current) {
            dummySeries2Ref.current.update({ time: timeVal, value: 50 });
          }
          if (dummySeries3Ref.current) {
            dummySeries3Ref.current.update({ time: timeVal, value: 0 });
          }

          candleSeriesRef.current.update({
            time: timeVal,
            open: lastCandle.open,
            high: lastCandle.high,
            low: lastCandle.low,
            close: lastCandle.close,
          });

          if (volumeSeriesRef.current) {
            const isUp = lastCandle.close >= lastCandle.open;
            volumeSeriesRef.current.update({
              time: timeVal,
              value: lastCandle.volume,
              color: isUp ? "rgba(34, 197, 94, 0.25)" : "rgba(239, 68, 68, 0.25)",
            });
          }

          if (!indicators) return;

          const lastIdx = sortedCandles.length - 1;

          const updateLine = (seriesRef: React.RefObject<ISeriesApi<"Line"> | null>, arr: number[] | undefined) => {
            if (seriesRef.current && arr) {
              const val = arr[lastIdx];
              if (val !== undefined && !isNaN(val)) {
                seriesRef.current.update({ time: timeVal, value: val });
              }
            }
          };

          const updateHist = (seriesRef: React.RefObject<ISeriesApi<"Histogram"> | null>, arr: number[] | undefined) => {
            if (seriesRef.current && arr) {
              const val = arr[lastIdx];
              if (val !== undefined && !isNaN(val)) {
                seriesRef.current.update({
                  time: timeVal,
                  value: val,
                  color: val >= 0 ? "rgba(34, 197, 94, 0.45)" : "rgba(239, 68, 68, 0.45)",
                });
              }
            }
          };

          if (showEMA) updateLine(emaSeriesRef, indicators.ema20);
          if (showSMA) updateLine(smaSeriesRef, indicators.sma50);

          if (showBB) {
            updateLine(bbUpperSeriesRef, indicators.bbUpper);
            updateLine(bbMiddleSeriesRef, indicators.bbMiddle);
            updateLine(bbLowerSeriesRef, indicators.bbLower);
          }

          updateLine(volumeMASeriesRef, indicators.volumeMA);
          updateLine(rsiSeriesRef, indicators.rsi);
          updateLine(macdLineSeriesRef, indicators.macdLine);
          updateLine(macdSignalSeriesRef, indicators.signalLine);
          updateHist(macdHistSeriesRef, indicators.macdHist);
        } catch (updateErr) {
          console.error("[Chart] Error during real-time update():", updateErr);
        }
      }

      // Set markers on the candlestick series for executions (BUY/SELL)
      if (candleSeriesRef.current && sortedCandles.length > 0) {
        const markers = tradeEvents.map((evt) => {
          // Find closest candle time
          let closestCandle = sortedCandles[0];
          let minDiff = Math.abs(sortedCandles[0].time - evt.time);
          for (const candle of sortedCandles) {
            const diff = Math.abs(candle.time - evt.time);
            if (diff < minDiff) {
              minDiff = diff;
              closestCandle = candle;
            }
          }

          const isBuy = evt.type === "BUY";
          return {
            time: (timezoneEngine.utcToLocal(closestCandle.time) / 1000) as UTCTimestamp,
            position: (isBuy ? "belowBar" : "aboveBar") as "belowBar" | "aboveBar",
            shape: (isBuy ? "arrowUp" : "arrowDown") as "arrowUp" | "arrowDown",
            color: isBuy ? "#22c55e" : "#ef4444",
            text: `${evt.type} @ $${getFormat(evt.price)}`,
          };
        });

        markers.sort((a, b) => (a.time as number) - (b.time as number));
        createSeriesMarkers(candleSeriesRef.current, markers);
      }
    } finally {
      setTimeout(() => {
        isSyncingRef.current = false;
      }, 50);
    }
  }, [candles, indicators, showEMA, showSMA, showBB, symbol, timeframe, chartReady, tradeEvents, resolvedTheme]);

  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col h-auto w-full shadow-sm" ref={containerRef}>
      {/* Header Controls Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <h3 className="font-extrabold text-card-foreground text-lg uppercase tracking-tight">
            {symbol}
          </h3>
          {wsStatus === "CONNECTED" && (
            <span className="text-[9px] font-black bg-emerald-500/10 text-emerald-500 border border-emerald-500/25 px-2 py-0.5 rounded tracking-widest uppercase animate-pulse">
              Live
            </span>
          )}
          {wsStatus === "RECONNECTING" && (
            <span className="text-[9px] font-black bg-amber-500/10 text-amber-500 border border-amber-500/25 px-2 py-0.5 rounded tracking-widest uppercase animate-pulse">
              Reconnecting
            </span>
          )}
          {wsStatus === "DISCONNECTED" && (
            <span className="text-[9px] font-black bg-rose-500/10 text-rose-500 border border-rose-500/25 px-2 py-0.5 rounded tracking-widest uppercase">
              Offline
            </span>
          )}
        </div>

        {/* View toggles & Interval switcher */}
        <div className="flex items-center gap-4 ml-auto sm:ml-0">
          <div className="flex items-center gap-2 border-r border-border pr-4 text-xs font-bold text-muted-foreground select-none">
            <button
              onClick={() => setShowEMA(!showEMA)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors ${showEMA ? 'bg-primary/10 text-primary border border-primary/20' : 'hover:bg-muted border border-transparent'}`}
            >
              {showEMA ? <Eye size={12} /> : <EyeOff size={12} />}
              <span>EMA(20)</span>
            </button>
            <button
              onClick={() => setShowSMA(!showSMA)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors ${showSMA ? 'bg-primary/10 text-primary border border-primary/20' : 'hover:bg-muted border border-transparent'}`}
            >
              {showSMA ? <Eye size={12} /> : <EyeOff size={12} />}
              <span>SMA(50)</span>
            </button>
            <button
              onClick={() => setShowBB(!showBB)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors ${showBB ? 'bg-primary/10 text-primary border border-primary/20' : 'hover:bg-muted border border-transparent'}`}
            >
              {showBB ? <Eye size={12} /> : <EyeOff size={12} />}
              <span>Bollinger</span>
            </button>
          </div>

          <div className="flex bg-muted/65 p-1 rounded-lg border border-border">
            <button
              onClick={() => setTimeframe("5m")}
              className={`text-xs font-black px-3 py-1 rounded-md transition-all ${timeframe === "5m" ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              5m
            </button>
            <button
              onClick={() => setTimeframe("15m")}
              className={`text-xs font-black px-3 py-1 rounded-md transition-all ${timeframe === "15m" ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              15m
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic Cursor Hover HUD Overlay Panel */}
      {hoverData && (
        <div className="bg-muted/30 border border-border rounded-xl px-4 py-2.5 mb-3 flex flex-wrap gap-x-6 gap-y-1.5 text-[11px] font-mono text-muted-foreground shrink-0 select-none leading-none">
          <div>O: <span className="text-foreground font-bold font-sans">${hoverData.open}</span></div>
          <div>H: <span className="text-foreground font-bold font-sans">${hoverData.high}</span></div>
          <div>L: <span className="text-foreground font-bold font-sans">${hoverData.low}</span></div>
          <div>C: <span className="text-foreground font-bold font-sans">${hoverData.close}</span></div>
          <div className="border-r border-border h-3 hidden md:block"></div>
          <div>Vol: <span className="text-foreground font-bold font-sans">{hoverData.volume}</span></div>
          {showEMA && (
            <div>EMA(20): <span className="text-blue-400 font-bold font-sans">${hoverData.ema}</span></div>
          )}
          {showSMA && (
            <div>SMA(50): <span className="text-yellow-500 font-bold font-sans">${hoverData.sma}</span></div>
          )}
          {showBB && (
            <div>BB: <span className="text-purple-400 font-bold font-sans">[{hoverData.bbLower} - {hoverData.bbUpper}]</span></div>
          )}
          <div className="border-r border-border h-3 hidden md:block"></div>
          <div>RSI(14): <span className="text-purple-400 font-bold font-sans">{hoverData.rsi}</span></div>
          <div>MACD: <span className="text-blue-400 font-bold font-sans">{hoverData.macd}</span></div>
          <div>Signal: <span className="text-rose-400 font-bold font-sans">{hoverData.macdSig}</span></div>
          <div>Hist: <span className="text-emerald-500 font-bold font-sans">{hoverData.macdHist}</span></div>
        </div>
      )}

      {/* Stacked Chart Canvas Views */}
      <div className="w-full space-y-1.5 flex flex-col">
        <div className="relative w-full rounded-lg border border-border/80 overflow-hidden bg-card/50" ref={mainChartRef}>
          {loading && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-card/65 text-muted-foreground backdrop-blur-[1px]">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mr-3"></div>
              <span className="text-sm font-bold">Recalculating indicators...</span>
            </div>
          )}

          {/* Active / Closed Position Overlay Renderers */}
          {chartReady && overlays.map((overlay) => (
            <TradeOverlayView key={overlay.id} overlay={overlay} chartWidth={clientWidth - 90} />
          ))}
        </div>
        
        <div className="relative w-full rounded-lg border border-border/80 overflow-hidden bg-card/50" ref={rsiChartRef}>
          <div className="absolute top-2 left-2 z-10 text-[9px] font-black uppercase text-muted-foreground/60 tracking-wider">
            Relative Strength Index (RSI)
          </div>
        </div>

        <div className="relative w-full rounded-lg border border-border/80 overflow-hidden bg-card/50" ref={macdChartRef}>
          <div className="absolute top-2 left-2 z-10 text-[9px] font-black uppercase text-muted-foreground/60 tracking-wider">
            MACD Oscillator
          </div>
        </div>
      </div>
    </div>
  );
}
