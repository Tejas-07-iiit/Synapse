# Final Strategies Table

| Strategy Name | Source System | Type | Complexity | Reusable? | Primary Indicators Used |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Mean Reversion** | Legacy Node.js | Mean-Reversion | Low-Medium | Yes (Refactored) | RSI14, Volatility (10-bar), Support & Resistance (10-bar) |
| **Momentum Strategy** | Legacy Node.js | Momentum | Medium | Yes (Refactored) | RSI14, Trend, Momentum, EMA20, EMA50, MACD, Volatility |
| **Defensive Strategy** | Legacy Node.js | Trend-Following | Low-Medium | Yes (Refactored) | RSI14, Momentum, MACD, Support Level |
| **Grid Strategy** | Legacy Node.js | Grid / Range | Medium | Yes (Refactored) | RSI14, Volatility, Support & Resistance, EMA20/50, MACD |
| **Lorentzian Classification** | Framework Native | Statistical / ML | High | Yes (Highly) | RSI, ADX, CCI, WaveTrend, EMA200 (k-NN Lite) |
| **Bollinger Breakout** | Framework Native | Breakout | Medium | Yes | Bollinger Bands (20,2), ADX14 |
| **Donchian Breakout** | Framework Native | Breakout | Low | Yes | Donchian Channels (20), ADX14 |
| **Rally Base Drop** | Framework Native | Market-Structure | Medium | Yes | Supply/Demand Zones, High-Volume zones |
| **Support Resistance Sweep** | Framework Native | Market-Structure | Medium | Yes | Range High/Low 52, RSI14 |
| **Bollinger Reversion** | Framework Native | Mean-Reversion | Low | Yes | Bollinger Bands (20,2), ADX14, RSI14 |
| **Short Term Reversal** | Framework Native | Mean-Reversion | Low | Yes | RSI14, Momentum12, EMA50 |
| **Dow Factor MFI RSI** | Framework Native | Momentum | Medium | Yes | Dow theory swing high/low, RSI14, MFI14 |
| **Parabolic RSI** | Framework Native | Momentum | Medium | Yes | Parabolic SAR applied to RSI(14) |
| **Range Breakout High** | Framework Native | Momentum | Low | Yes | Range High/Low 52, EMA50 |
| **Residual Momentum** | Framework Native | Momentum | Low | Yes | Momentum12, EMA50, EMA200 |
| **Time Series Momentum** | Framework Native | Momentum | Low | Yes | Momentum12, ADX14 |
| **WaveTrend Oscillator** | Framework Native | Momentum | Medium | Yes | WaveTrend (LazyBear), EMA20 |
| **Hash Ribbons** | Framework Native | Sentiment | Medium | Optional | Hashrate SMA 30/60 (Crypto-specific) |
| **News Fear Greed** | Framework Native | Sentiment | High | Yes | News Sentiment, Fear/Greed Index |
| **EMA Cross ADX** | Framework Native | Trend-Following | Low | Yes | EMA20, EMA50, ADX14, MACD |
| **Golden Cross** | Framework Native | Trend-Following | Low | Yes | SMA50, SMA200 |
| **Heiken Ashi Swing** | Framework Native | Trend-Following | Medium | Yes | Heiken Ashi color flips (Slow confirmation) |
| **Hyper Supertrend** | Framework Native | Trend-Following | Medium | Yes | Supertrend (10, 2) + Supertrend (12, 3) |
| **Ichimoku Cloud** | Framework Native | Trend-Following | Medium | Yes | Tenkan, Kijun, Senkou Span A/B |
| **MA Crossover Variable** | Framework Native | Trend-Following | Low | Yes | EMA20, EMA50, SMA200 |
| **SMA Trend Filter** | Framework Native | Trend-Following | Low | Yes | SMA50, SMA200, RSI14 |
| **T3 Nexus** | Framework Native | Trend-Following | Medium | Yes | Tillson T3 Moving Average (8, 0.7) |
| **Squeeze Momentum** | Framework Native | Volatility | Medium | Yes | Bollinger Bands inside Keltner Channels |
| **Volatility Regime** | Framework Native | Volatility | Low | Yes | ATRPct, ADX14 |
| **Zeiierman Volatility** | Framework Native | Volatility | Medium | Yes | Volatility Bands, ADX14, Volume |



    evaluate
    generateSignal
    validate
    analyze
    
    
    
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
  openedAt: string;
  closedAt: string | null;
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
const TradeOverlayView = ({ overlay, chartApi, seriesApi, currentPrice }: { overlay: TradeOverlay; chartApi: IChartApi; seriesApi: ISeriesApi<"Candlestick">; currentPrice: number }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    direction,
    status,
    entryPrice,
    tpPrice,
    slPrice,
    quantity,
    pnl,
    roi,
    exitPrice,
    closeReason,
    openedAt,
    closedAt,
  } = overlay;

  const isOpen = status === "OPEN";

  // Calculate Risk/Reward ratio
  const riskPct = Math.abs(entryPrice - slPrice) / entryPrice * 100;
  const rewardPct = Math.abs(tpPrice - entryPrice) / entryPrice * 100;
  const rrRatio = riskPct > 0 ? (rewardPct / riskPct).toFixed(2) : "0.00";

  useEffect(() => {
    let rafId: number;
    const syncDOM = () => {
      if (!containerRef.current || !chartApi || !seriesApi) return;
      
      const openedAtSeconds = Math.floor(new Date(openedAt).getTime() / 1000);
      const startXVal = chartApi.timeScale().timeToCoordinate(openedAtSeconds as UTCTimestamp);
      
      let endXVal: number | null = null;
      if (!isOpen && closedAt) {
        const closedAtSeconds = Math.floor(new Date(closedAt).getTime() / 1000);
        endXVal = chartApi.timeScale().timeToCoordinate(closedAtSeconds as UTCTimestamp);
      }
      
      const chartWidth = chartApi.timeScale().width(); 

      let startX = startXVal !== null ? startXVal : 0;
      let endX = endXVal !== null ? endXVal : chartWidth;
      
      if (startX < 0) startX = 0;
      if (endX > chartWidth) endX = chartWidth;

      const width = endX - startX;
      
      const entryY = seriesApi.priceToCoordinate(entryPrice);
      const tpY = seriesApi.priceToCoordinate(tpPrice);
      const slY = seriesApi.priceToCoordinate(slPrice);
      const priceY = seriesApi.priceToCoordinate(isOpen ? currentPrice : (exitPrice || entryPrice));
      
      if (entryY === null || tpY === null || slY === null) {
          containerRef.current.style.display = "none";
      } else {
          containerRef.current.style.display = "block";
          containerRef.current.style.setProperty('--startX', `${startX}px`);
          containerRef.current.style.setProperty('--width', `${width > 0 ? width : 0}px`);
          containerRef.current.style.setProperty('--entryY', `${entryY}px`);
          containerRef.current.style.setProperty('--tpY', `${tpY}px`);
          containerRef.current.style.setProperty('--slY', `${slY}px`);
          containerRef.current.style.setProperty('--priceY', `${priceY}px`);
          containerRef.current.style.setProperty('--tpTop', `${Math.min(entryY, tpY)}px`);
          containerRef.current.style.setProperty('--tpHeight', `${Math.abs(entryY - tpY)}px`);
          containerRef.current.style.setProperty('--slTop', `${Math.min(entryY, slY)}px`);
          containerRef.current.style.setProperty('--slHeight', `${Math.abs(entryY - slY)}px`);
      }
      
      rafId = requestAnimationFrame(syncDOM);
    };
    syncDOM();
    return () => cancelAnimationFrame(rafId);
  }, [chartApi, seriesApi, entryPrice, tpPrice, slPrice, currentPrice, isOpen, openedAt, closedAt, exitPrice]);

  const isLong = direction === "LONG";
  const entryColor = isOpen ? "#0ea5e9" : "#64748b"; 
  const tpColor = isOpen ? "#22c55e" : "#059669"; 
  const slColor = isOpen ? "#ef4444" : "#dc2626";

  return (
    <div 
      ref={containerRef}
      className={`absolute inset-0 pointer-events-none z-20 select-none ${isOpen ? "opacity-100" : "opacity-40 transition-opacity duration-300 hover:opacity-75"}`}
    >
      {/* 1. Green Zone (TP Box - Profit Zone) */}
      <div 
        className="absolute border-l"
        style={{
          top: "var(--tpTop)", left: "var(--startX)", width: "var(--width)", height: "var(--tpHeight)",
          backgroundColor: isOpen ? "rgba(34, 197, 94, 0.12)" : "rgba(34, 197, 94, 0.04)",
          borderLeft: `2px ${isOpen ? "solid" : "dashed"} ${isLong ? tpColor : slColor}`,
          borderColor: isLong ? "rgba(34, 197, 94, 0.4)" : "rgba(239, 68, 68, 0.4)",
        }}
      />

      {/* 2. Red Zone (SL Box - Loss Zone) */}
      <div 
        className="absolute border-l"
        style={{
          top: "var(--slTop)", left: "var(--startX)", width: "var(--width)", height: "var(--slHeight)",
          backgroundColor: isOpen ? "rgba(239, 68, 68, 0.12)" : "rgba(239, 68, 68, 0.04)",
          borderLeft: `2px ${isOpen ? "solid" : "dashed"} ${isLong ? slColor : tpColor}`,
          borderColor: isLong ? "rgba(239, 68, 68, 0.4)" : "rgba(34, 197, 94, 0.4)",
        }}
      />

      {/* 3. Entry Line */}
      <div 
        className="absolute flex items-center"
        style={{ top: "var(--entryY)", left: "var(--startX)", width: "var(--width)", borderTop: `1px solid ${entryColor}` }}
      >
        <div 
          className="bg-background/95 text-foreground border text-[10px] font-medium px-1.5 py-0.5 rounded-r shadow-sm -translate-y-1/2 select-none"
          style={{ borderColor: `${entryColor}60`, color: entryColor }}
        >
          {direction} {quantity.toFixed(4)} @ {entryPrice.toLocaleString()}
        </div>
      </div>

      {/* 4. Take Profit Line */}
      <div 
        className="absolute flex items-center"
        style={{ top: "var(--tpY)", left: "var(--startX)", width: "var(--width)", borderTop: `1px solid ${isLong ? tpColor : slColor}` }}
      >
        <div 
          className="bg-background/95 border text-[10px] font-medium px-1.5 py-0.5 rounded-r shadow-sm -translate-y-1/2 select-none"
          style={{ borderColor: isLong ? `${tpColor}60` : `${slColor}60`, color: isLong ? tpColor : slColor }}
        >
          TP {tpPrice.toLocaleString()}
        </div>
      </div>

      {/* 5. Stop Loss Line */}
      <div 
        className="absolute flex items-center"
        style={{ top: "var(--slY)", left: "var(--startX)", width: "var(--width)", borderTop: `1px solid ${isLong ? slColor : tpColor}` }}
      >
        <div 
          className="bg-background/95 border text-[10px] font-medium px-1.5 py-0.5 rounded-r shadow-sm -translate-y-1/2 select-none"
          style={{ borderColor: isLong ? `${slColor}60` : `${tpColor}60`, color: isLong ? slColor : tpColor }}
        >
          SL {slPrice.toLocaleString()}
        </div>
      </div>

      {/* 6. Live HUD Label (Floating PNL & Status Tag) */}
      <div 
        className="absolute flex items-center gap-1.5"
        style={{ top: "var(--priceY)", left: "calc(var(--startX) + var(--width) - 130px)", transform: "translateY(-50%)" }}
      >
        {isOpen ? (
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-bold border shadow-sm bg-card/90 backdrop-blur-sm ${pnl >= 0 ? "text-emerald-500 border-emerald-500/20" : "text-rose-500 border-rose-500/20"}`}>
                <span>{pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}</span>
                <span className="opacity-80">({pnl >= 0 ? "+" : ""}{roi.toFixed(2)}%)</span>
                <span className="text-[9px] text-muted-foreground ml-1">R:R {rrRatio}</span>
            </div>
        ) : (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-semibold border shadow-sm bg-muted/80 text-muted-foreground border-border backdrop-blur-sm">
                <span>{closeReason || "CLOSED"}</span>
                <span>{pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}</span>
            </div>
        )}
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

  // Overlay Visibility Toggles
  const [showEMA, setShowEMA] = useState(false);
  const [showSMA, setShowSMA] = useState(false);

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

  // DOM Refs
  const mainChartRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Chart Instances
  const chart1Ref = useRef<IChartApi | null>(null);

  // Series Instances
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const emaSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const smaSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const volumeMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  // Previous states to distinguish full reload vs update
  const prevSymbolRef = useRef<string>("");
  const prevTimeframeRef = useRef<string>("");
  const prevCandlesLengthRef = useRef<number>(0);
  const prevShowEMARef = useRef<boolean>(false);
  const prevShowSMARef = useRef<boolean>(false);
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

  const livePrice = tickerData[symbol.toUpperCase()]?.price;

  // Recalculate overlay Y and X coordinates
  const updateOverlays = useCallback(() => {
    if (!chartReady || !chart1Ref.current || !candleSeriesRef.current || !mainChartRef.current || clientWidth === 0) return;

    // Reference dependencies to satisfy React Hook ESLint rules
    void livePrice;

    const currentSymbol = symbol.toUpperCase();
    const currentPrice = tickerData[currentSymbol]?.price || (candles.length > 0 ? candles[candles.length - 1].close : 0);

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
        openedAt: pos.openedAt,
        closedAt: null,
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
        openedAt: t.openedAt,
        closedAt: t.closedAt,
      });
    });

    setOverlays(newOverlays);
  }, [chartReady, symbol, activePositions, closedTrades, candles, clientWidth, livePrice, tickerData]);

  useEffect(() => {
    updateOverlays();
  }, [updateOverlays]);

  useEffect(() => {
    if (!mainChartRef.current) return;

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
        visible: true,
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

    // Add overlays (EMA, SMA)
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

    // Add Volume series on the main chart
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
      });
    };

    chart1.subscribeCrosshairMove(handleCrosshairMove);

    // --- RESPONSIVE RESIZING WITH RESIZEOBSERVER ---
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width } = entries[0].contentRect;
      if (width > 0) {
        chart1.resize(width, 600);
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
      chart1.remove();
    };
  }, [resolvedTheme, updateHoverWithLatest]);

  // Handle Indicator Visibility Toggles Natively
  useEffect(() => {
    if (!chartReady) return;
    
    if (emaSeriesRef.current) emaSeriesRef.current.applyOptions({ visible: showEMA });
    if (smaSeriesRef.current) smaSeriesRef.current.applyOptions({ visible: showSMA });
  }, [showEMA, showSMA, chartReady]);

  // Feed/Sync Data to Chart series
  useEffect(() => {
    if (!chartReady || !candleSeriesRef.current) return;

    if (candles.length === 0) {
      candleSeriesRef.current.setData([]);
      if (volumeSeriesRef.current) volumeSeriesRef.current.setData([]);
      if (emaSeriesRef.current) emaSeriesRef.current.setData([]);
      if (smaSeriesRef.current) smaSeriesRef.current.setData([]);
      if (volumeMASeriesRef.current) volumeMASeriesRef.current.setData([]);
      return;
    }

    isSyncingRef.current = true;

    // Create a copy of candles and sort by time (ascending) to prevent lightweight-charts errors
    const sortedCandles = [...candles].sort((a, b) => a.time - b.time);

    const isNewSymbolOrTimeframe = 
      symbol !== prevSymbolRef.current || 
      timeframe !== prevTimeframeRef.current;

    const isThemeChanged = resolvedTheme !== prevThemeRef.current;

    const isIndicatorsLoaded = !prevIndicatorsRef.current && !!indicators;

    const isFullReload = 
      isNewSymbolOrTimeframe || 
      isThemeChanged ||
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

    try {
      if (isFullReload) {
        // 1. Full reload using setData()
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
        if (emaSeriesRef.current && indicators.ema20) {
          emaSeriesRef.current.setData(createLineData(indicators.ema20));
        }

        // Plot SMA(50)
        if (smaSeriesRef.current && indicators.sma50) {
          smaSeriesRef.current.setData(createLineData(indicators.sma50));
        }

        // Plot Volume MA
        if (volumeMASeriesRef.current && indicators.volumeMA) {
          volumeMASeriesRef.current.setData(createLineData(indicators.volumeMA));
        }

        // Autoscale and fit content on symbol/timeframe load to prevent compressed/cut off candles
        if (chart1Ref.current && isNewSymbolOrTimeframe) {
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

          updateLine(emaSeriesRef, indicators.ema20);
          updateLine(smaSeriesRef, indicators.sma50);
          updateLine(volumeMASeriesRef, indicators.volumeMA);
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
  }, [candles, indicators, showEMA, showSMA, symbol, timeframe, chartReady, tradeEvents, resolvedTheme]);

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
        </div>
      )}

      {/* Stacked Chart Canvas Views */}
      <div className="w-full flex flex-col h-[600px]">
        <div className="relative w-full h-full rounded-lg border border-border/80 overflow-hidden bg-card/50" ref={mainChartRef}>
          {loading && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-card/65 text-muted-foreground backdrop-blur-[1px]">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mr-3"></div>
              <span className="text-sm font-bold">Recalculating indicators...</span>
            </div>
          )}

          {/* Active / Closed Position Overlay Renderers */}
          {chartReady && chart1Ref.current && candleSeriesRef.current && overlays.map((overlay) => (
            <TradeOverlayView key={overlay.id} overlay={overlay} chartApi={chart1Ref.current!} seriesApi={candleSeriesRef.current!} currentPrice={tickerData[symbol.toUpperCase()]?.price || candles[candles.length - 1]?.close || 0} />
          ))}
        </div>
      </div>
    </div>
  );
}




I have completed a deep architectural audit of the autonomous trading execution flow, spanning the MarketEngine, StrategyEngine, SignalPriorityEngine, and PaperTradingEngine. 

  You are entirely correct—this is not a UI issue. This is a severe orchestration and concurrency failure. The system suffers from a combination of stale state execution on boot,
  asynchronous race conditions, and missing cooldown mechanisms, causing it to act like a machine gun rather than a disciplined institutional engine.

  Here is the complete Root-Cause Analysis Report.

  ---

  1. The "Initialization Spasm" (Stale Signal Execution on Boot)
  Severity: CRITICAL
   * Files: src/market-engine/market-engine.ts, src/strategy-engine/core/engine.ts
   * Functions: MarketEngine.init() -> recalculate(..., isClosed: false)
   * The Bug: When a new account logs in and the dashboard mounts, marketEngine.init() fetches historical candles. It immediately forces a strategy evaluation (recalculate(..., false))
     for all coins across all timeframes (5m, 15m, active). Because the live candle is incomplete, the engine evaluates the last closed candle. 
   * Why it overtrades: The in-memory StrategyEngine.signalLocks is empty on boot. Therefore, it treats these old historical setups (which might have closed 14 minutes ago) as
     brand-new signals. It blindly passes them to the execution engine, resulting in up to 9 immediate, stale market orders being placed the millisecond the app loads.

  2. Unordered Boot Sequence (Position Blindness)
  Severity: CRITICAL
   * File: src/market-engine/market-engine.ts
   * Function: MarketEngine.init()
   * The Bug: The initialization sequence is architecturally flawed. 
       * Step 1: It runs the recalculate() loop (which executes the stale trades mentioned above).
       * Step 3: It finally calls PaperTradingEngine.loadActivePositions(userId).
   * Why it overtrades: The engine fires trades before it checks the database for existing open positions. The 1-trade-per-symbol limit is completely bypassed because the engine is
     temporarily blind to its own database state during boot.

  3. Concurrency Race Condition (Timeframe Overlap)
  Severity: HIGH
   * Files: src/market-engine/market-engine.ts, src/execution-engine/paper/index.ts
   * Functions: MarketEngine.onCandleClose(), PaperTradingEngine.openPosition()
   * The Bug: When a 15-minute candle closes, Binance fires isClosed=true for both the kline_5m and kline_15m WebSocket streams simultaneously. onCandleClose triggers recalculate("5m")
     and recalculate("15m") concurrently (no await synchronization).
   * Why it overtrades: Both timeframes evaluate independently. If both generate a signal (e.g., strong momentum), they both check the in-memory open positions simultaneously. Finding
     none, they both await fetch() the database. Due to network latency, both DB queries return false. Both then POST a new trade, successfully creating duplicate stacked positions for
     the exact same coin.

  4. Missing Cooldown & Execution Debounce
  Severity: HIGH
   * File: src/execution-engine/paper/index.ts
   * Functions: PaperTradingEngine.updatePrices(), closePosition()
   * The Bug: There is absolutely no cooldown logic. 
   * Why it overtrades: If the engine opens a trade and it immediately gets stopped out (SL Hit) within seconds, the position is instantly deleted from memory. Because the candle may
     still meet the strategy criteria (or another timeframe's evaluation triggers), the engine sees activePositions = 0 and instantly fires another trade. This creates an infinite loop
     of death-by-fees until the strategy criteria naturally invalidates.

  5. Weak Confidence Filtering (Noise Spam)
  Severity: MEDIUM
   * File: src/strategy-engine/core/signal-priority.ts
   * Function: SignalPriorityEngine.prioritize()
   * The Bug: The CONFIDENCE_THRESHOLD is hardcoded to 55.
   * Why it overtrades: 55% is barely above a coin-flip. During ranging or choppy markets, indicators will frequently cross this threshold, spamming the recalculate loop with
     low-quality setups.

  6. Missing Database Constraints
  Severity: MEDIUM
   * File: app/api/positions/route.ts / prisma/schema.prisma
   * The Bug: The /api/positions endpoint (action: "open") blindly inserts new trades. 
   * Why it overtrades: There is no database-level unique constraint or transaction lock on [userId, symbol, status='OPEN']. Application-layer race conditions are allowed to pollute
     the database without a final safety net.

  ---

  Architectural Assumptions That Are Wrong

   1. "Evaluating strategies on initialization is safe." It is not. Historical backfill data should only be used to warm up indicators, not to trigger live execution pipelines.
   2. "Memory reads are safe before async DB writes." They are not. Relying on await fetch() inside an execution loop without a mutex lock guarantees race conditions when WebSockets
      fire concurrently.
   3. "A signal lock based on candle time is enough." It is not. The system needs to lock the execution of the symbol, not just the generation of the signal.

  Recommended Fixes & Safe Architecture Proposal

  Before we write any code, here is how the architecture must be refactored to achieve institutional-grade safety:

   1. Refactor Boot Sequence: MarketEngine.init() must await PaperTradingEngine.loadActivePositions() before fetching any candles or running any calculations.
   2. Mute Executions on Boot: Introduce an isBooting or historicalBackfill flag. During init(), pass this flag to recalculate(). If true, the engine generates signals for UI display
      but strictly bypasses the PaperTradingEngine.openPosition() block.
   3. Implement an Execution Mutex (Lock): In PaperTradingEngine, implement a static execution lock (Set<string>) for symbols. If a trade is actively being negotiated with the
      database, all concurrent attempts for that symbol must be instantly rejected until the DB responds.
   4. Implement a Cooldown Engine: Add a lastTradeTime map in PaperTradingEngine. Enforce a strict, hardcoded cooldown (e.g., 15 minutes) for a specific symbol after a trade closes,
      regardless of the reason.
   5. Strict DB Upserts: Modify /api/positions to use a transaction or upsert pattern, ensuring it returns an error if an open position already exists for that user/symbol.
   6. Raise Signal Threshold: Increase the minimum confidence threshold in SignalPriorityEngine to 75+ for autonomous execution.

  I am ready to surgically implement these fixes into the execution pipeline whenever you give the directive.


