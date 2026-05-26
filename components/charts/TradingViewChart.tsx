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
  MouseEventParams
} from "lightweight-charts";
import { useMarketStore } from "@/store/market/useMarketStore";
import { IndicatorValues } from "@/types/market";
import { useTheme } from "next-themes";
import { Eye, EyeOff } from "lucide-react";

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

  const { resolvedTheme } = useTheme();

  // Overlay Visibility Toggles
  const [showEMA, setShowEMA] = useState(true);
  const [showSMA, setShowSMA] = useState(true);
  const [showBB, setShowBB] = useState(true);

  // Dynamic Hover HUD State
  const [hoverData, setHoverData] = useState<HoverData | null>(null);
  const isHoveringRef = useRef(false);

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
  const prevShowEMARef = useRef<boolean>(true);
  const prevShowSMARef = useRef<boolean>(true);
  const prevShowBBRef = useRef<boolean>(true);
  const isSyncingRef = useRef<boolean>(false);
  const prevIndicatorsRef = useRef<IndicatorValues | null>(null);

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
    if (!mainChartRef.current || !rsiChartRef.current || !macdChartRef.current) return;

    // Theme values
    const isDark = resolvedTheme === "dark";
    const colors = {
      bg: isDark ? "#090d16" : "#ffffff",
      text: isDark ? "#94a3b8" : "#475569",
      grid: isDark ? "#161f32" : "#f1f5f9",
      border: isDark ? "#1e293b" : "#e2e8f0",
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
      visible: false,
    });
    volumeSeriesRef.current = volumeSeries;

    // Add Volume Moving Average (plotted over the volume scale)
    const volumeMASeries = chart1.addSeries(LineSeries, {
      color: "rgba(148, 163, 184, 0.4)",
      lineWidth: 1,
      priceScaleId: "volume-scale",
    });
    volumeMASeriesRef.current = volumeMASeries;

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
    const syncTimeScale = (sourceChart: IChartApi, targets: IChartApi[]) => {
      sourceChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (isSyncingRef.current || !range) return;
        isSyncingRef.current = true;
        targets.forEach((target) => {
          const targetRange = target.timeScale().getVisibleLogicalRange();
          if (!targetRange || targetRange.from !== range.from || targetRange.to !== range.to) {
            target.timeScale().setVisibleLogicalRange(range);
          }
        });
        isSyncingRef.current = false;
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
      const idx = currentCandles.findIndex((c) => Math.floor(c.time / 1000) === (param.time as number));
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

    // Handle Window Resize events
    const handleResize = () => {
      if (mainChartRef.current && rsiChartRef.current && macdChartRef.current) {
        const width = mainChartRef.current.clientWidth;
        chart1.resize(width, 600);
        chart2.resize(width, 120);
        chart3.resize(width, 140);
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart1.unsubscribeCrosshairMove(handleCrosshairMove);
      chart2.unsubscribeCrosshairMove(handleCrosshairMove);
      chart3.unsubscribeCrosshairMove(handleCrosshairMove);
      chart1.remove();
      chart2.remove();
      chart3.remove();
    };
  }, [resolvedTheme, updateHoverWithLatest]);

  // Feed/Sync Data to Chart series
  useEffect(() => {
    if (candles.length === 0 || !candleSeriesRef.current) return;

    isSyncingRef.current = true;

    // Create a copy of candles and sort by time (ascending) to prevent lightweight-charts errors
    const sortedCandles = [...candles].sort((a, b) => a.time - b.time);

    const isNewSymbolOrTimeframe = 
      symbol !== prevSymbolRef.current || 
      timeframe !== prevTimeframeRef.current;

    const isVisibilityToggled = 
      showEMA !== prevShowEMARef.current ||
      showSMA !== prevShowSMARef.current ||
      showBB !== prevShowBBRef.current;

    const isIndicatorsLoaded = !prevIndicatorsRef.current && !!indicators;

    const isFullReload = 
      isNewSymbolOrTimeframe || 
      isVisibilityToggled ||
      isIndicatorsLoaded ||
      sortedCandles.length < prevCandlesLengthRef.current || 
      Math.abs(sortedCandles.length - prevCandlesLengthRef.current) > 1;

    // Update refs for the next run
    prevSymbolRef.current = symbol;
    prevTimeframeRef.current = timeframe;
    prevCandlesLengthRef.current = sortedCandles.length;
    prevShowEMARef.current = showEMA;
    prevShowSMARef.current = showSMA;
    prevShowBBRef.current = showBB;
    prevIndicatorsRef.current = indicators;

    const createLineData = (arr: number[]): LineData[] => {
      const result: LineData[] = [];
      for (let idx = 0; idx < arr.length; idx++) {
        const val = arr[idx];
        if (val !== undefined && !isNaN(val)) {
          result.push({
            time: (sortedCandles[idx].time / 1000) as UTCTimestamp,
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
        if (val !== undefined && !isNaN(val)) {
          result.push({
            time: (sortedCandles[idx].time / 1000) as UTCTimestamp,
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
          time: (c.time / 1000) as UTCTimestamp,
          value: 50,
        }));
        const dummyData3: LineData[] = sortedCandles.map((c) => ({
          time: (c.time / 1000) as UTCTimestamp,
          value: 0,
        }));

        if (dummySeries2Ref.current) {
          dummySeries2Ref.current.setData(dummyData2);
        }
        if (dummySeries3Ref.current) {
          dummySeries3Ref.current.setData(dummyData3);
        }

        const candleData: CandlestickData[] = sortedCandles.map((c) => ({
          time: (c.time / 1000) as UTCTimestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }));

        const volumeData: HistogramData[] = sortedCandles.map((c) => {
          const isUp = c.close >= c.open;
          return {
            time: (c.time / 1000) as UTCTimestamp,
            value: c.volume,
            color: isUp ? "rgba(34, 197, 94, 0.25)" : "rgba(239, 68, 68, 0.25)",
          };
        });

        candleSeriesRef.current.setData(candleData);
        if (volumeSeriesRef.current) {
          volumeSeriesRef.current.setData(volumeData);
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
        const timeVal = (lastCandle.time / 1000) as UTCTimestamp;

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
      }
    } finally {
      setTimeout(() => {
        isSyncingRef.current = false;
      }, 50);
    }
  }, [candles, indicators, showEMA, showSMA, showBB, symbol, timeframe]);

  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col h-auto w-full shadow-sm" ref={containerRef}>
      {/* Header Controls Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <h3 className="font-extrabold text-card-foreground text-lg uppercase tracking-tight">
            {symbol}
          </h3>
          <span className="text-[9px] font-black bg-primary/15 text-primary border border-primary/25 px-2 py-0.5 rounded tracking-widest uppercase">
            Live Engine
          </span>
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
