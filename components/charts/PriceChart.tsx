"use client";

import React, { useEffect, useRef, useMemo } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  CrosshairMode,
  LineStyle,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type Time,
  type UTCTimestamp,
  type SeriesMarker,
  type IPriceLine,
} from "lightweight-charts";
import { useTheme } from "next-themes";
import { Candle, IndicatorValues } from "@/types/market";
import { timezoneEngine } from "@/services/market/timezone";

export interface ChartMarker {
  time: number;
  position: "aboveBar" | "belowBar";
  color: string;
  shape: "arrowUp" | "arrowDown";
  text: string;
}

export interface ChartPriceLine {
  id: string;
  price: number;
  color: string;
  lineStyle?: LineStyle;
  title: string;
}

interface PriceChartProps {
  symbol: string;
  candles: Candle[];
  indicators: IndicatorValues | null;
  markers?: ChartMarker[];
  priceLines?: ChartPriceLine[];
  showEMA?: boolean;
  showSMA?: boolean;
  onCrosshairMove?: (data: {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    ema?: number;
    sma?: number;
  } | null) => void;
}

export function PriceChart({
  symbol,
  candles,
  indicators,
  markers = [],
  priceLines = [],
  showEMA = false,
  showSMA = false,
  onCrosshairMove,
  onChartReady,
}: PriceChartProps & {
  onChartReady?: (chart: IChartApi, series: ISeriesApi<"Candlestick">) => void;
}) {
  const { resolvedTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  
  // Series Refs
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const emaSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const smaSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const volumeMASeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const markersPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  
  const priceLinesRef = useRef<Map<string, IPriceLine>>(new Map());
  const lastTimeRef = useRef<number>(0);
  const firstTimeRef = useRef<number>(0);
  const dataHydratedRef = useRef<boolean>(false);

  // 1. Core Chart Initialization
  useEffect(() => {
    if (!containerRef.current) return;

    const isDark = resolvedTheme === "dark";
    const colors = {
      bg: "transparent",
      text: isDark ? "#a1a1aa" : "#64748b",
      grid: isDark ? "#18181b" : "#f1f5f9",
      border: isDark ? "#18181b" : "#e2e8f0",
      crosshair: isDark ? "rgba(161, 161, 170, 0.4)" : "rgba(100, 116, 139, 0.4)",
    };

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: colors.bg },
        textColor: colors.text,
        fontFamily: "var(--font-sans), system-ui, sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: colors.grid },
        horzLines: { color: colors.grid },
      },
      rightPriceScale: {
        borderColor: colors.border,
        scaleMargins: { top: 0.1, bottom: 0.15 },
        autoScale: true,
        alignLabels: true,
      },
      timeScale: {
        borderColor: colors.border,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 15,
        barSpacing: 8,
        minBarSpacing: 1,
        fixLeftEdge: true,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: colors.crosshair,
          labelBackgroundColor: colors.text,
        },
        horzLine: {
          color: colors.crosshair,
          labelBackgroundColor: colors.text,
        },
      },
      autoSize: true,
    });

    // Candlestick Series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
      priceFormat: { type: "price", precision: 2, minMove: 0.01 },
    });

    // Volume Series
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });

    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    // EMA Series
    const emaSeries = chart.addSeries(LineSeries, {
      color: "#3b82f6",
      lineWidth: 2,
      visible: showEMA,
    });

    // SMA Series
    const smaSeries = chart.addSeries(LineSeries, {
      color: "#eab308",
      lineWidth: 2,
      visible: showSMA,
    });

    // Volume MA Series
    const volumeMASeries = chart.addSeries(LineSeries, {
      color: "rgba(148, 163, 184, 0.4)",
      lineWidth: 1,
      priceScaleId: "volume",
    });

    // Handle Crosshair Move
    chart.subscribeCrosshairMove((param) => {
      if (!onCrosshairMove) return;
      if (!param.time || param.point === undefined || !param.seriesData.get(candleSeries)) {
        onCrosshairMove(null);
        return;
      }

      const candleData = param.seriesData.get(candleSeries) as { open: number; high: number; low: number; close: number } | undefined;
      const volumeData = param.seriesData.get(volumeSeries) as { value: number } | undefined;
      const emaData = param.seriesData.get(emaSeries) as { value: number } | undefined;
      const smaData = param.seriesData.get(smaSeries) as { value: number } | undefined;

      onCrosshairMove({
        open: candleData?.open ?? 0,
        high: candleData?.high ?? 0,
        low: candleData?.low ?? 0,
        close: candleData?.close ?? 0,
        volume: volumeData ? volumeData.value : 0,
        ema: emaData ? emaData.value : undefined,
        sma: smaData ? smaData.value : undefined,
      });
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    emaSeriesRef.current = emaSeries;
    smaSeriesRef.current = smaSeries;
    volumeMASeriesRef.current = volumeMASeries;
    
    // Initialize markers plugin
    markersPluginRef.current = createSeriesMarkers(candleSeries, []);

    if (onChartReady) {
      onChartReady(chart, candleSeries);
    }

    return () => {
      priceLinesRef.current.clear();
      markersPluginRef.current?.detach();
      markersPluginRef.current = null;
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      emaSeriesRef.current = null;
      smaSeriesRef.current = null;
      volumeMASeriesRef.current = null;
      dataHydratedRef.current = false;
    };
  }, []);


  // 2. Sync Theme
  useEffect(() => {
    if (!chartRef.current) return;
    const isDark = resolvedTheme === "dark";
    const colors = {
      text: isDark ? "#a1a1aa" : "#64748b",
      grid: isDark ? "#18181b" : "#f1f5f9",
      border: isDark ? "#18181b" : "#e2e8f0",
      crosshair: isDark ? "rgba(161, 161, 170, 0.4)" : "rgba(100, 116, 139, 0.4)",
    };

    chartRef.current.applyOptions({
      layout: { textColor: colors.text },
      grid: {
        vertLines: { color: colors.grid },
        horzLines: { color: colors.grid },
      },
      rightPriceScale: { borderColor: colors.border },
      timeScale: { borderColor: colors.border },
      crosshair: {
        vertLine: { color: colors.crosshair, labelBackgroundColor: colors.text },
        horzLine: { color: colors.crosshair, labelBackgroundColor: colors.text },
      },
    });
  }, [resolvedTheme]);

  // 3. Indicator Visibility
  useEffect(() => {
    emaSeriesRef.current?.applyOptions({ visible: showEMA });
    smaSeriesRef.current?.applyOptions({ visible: showSMA });
  }, [showEMA, showSMA]);

  // 4. Data Hydration & Real-time Updates
  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current || candles.length === 0) return;

    // We use the same strategy as TradeFlow:
    // If not hydrated, use setData. Otherwise use update for the last tick.
    const toTime = (ms: number) => (timezoneEngine.utcToLocal(ms) / 1000) as UTCTimestamp;

    const currentFirstTime = candles[0].time;
    const isNewDataset = dataHydratedRef.current && currentFirstTime !== firstTimeRef.current;

    if (!dataHydratedRef.current || isNewDataset) {
      // Full Data Set
      const sorted = [...candles].sort((a, b) => a.time - b.time);
      
      candleSeriesRef.current.setData(sorted.map(c => ({
        time: toTime(c.time),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })));

      volumeSeriesRef.current?.setData(sorted.map(c => ({
        time: toTime(c.time),
        value: c.volume,
        color: c.close >= c.open ? "rgba(34, 197, 94, 0.25)" : "rgba(239, 68, 68, 0.25)",
      })));

      if (indicators) {
        const createLineData = (arr: number[]) => {
          return arr.map((val, i) => {
            if (val === undefined || isNaN(val) || !sorted[i]) return null;
            return {
              time: toTime(sorted[i].time),
              value: val,
            };
          }).filter(Boolean) as { time: Time; value: number }[];
        };

        if (indicators.ema20) emaSeriesRef.current?.setData(createLineData(indicators.ema20));
        if (indicators.sma50) smaSeriesRef.current?.setData(createLineData(indicators.sma50));
        if (indicators.volumeMA) volumeMASeriesRef.current?.setData(createLineData(indicators.volumeMA));
      }

      dataHydratedRef.current = true;
      firstTimeRef.current = currentFirstTime;
      lastTimeRef.current = sorted[sorted.length - 1].time;
      
      // Auto-fit content once
      setTimeout(() => {
        chartRef.current?.timeScale().fitContent();
      }, 100);
    } else {
      // Real-time Update
      const lastCandle = candles[candles.length - 1];
      if (lastCandle.time < lastTimeRef.current) return;

      const timeVal = toTime(lastCandle.time);
      candleSeriesRef.current.update({
        time: timeVal,
        open: lastCandle.open,
        high: lastCandle.high,
        low: lastCandle.low,
        close: lastCandle.close,
      });

      volumeSeriesRef.current?.update({
        time: timeVal,
        value: lastCandle.volume,
        color: lastCandle.close >= lastCandle.open ? "rgba(34, 197, 94, 0.25)" : "rgba(239, 68, 68, 0.25)",
      });

      if (indicators) {
        const lastIdx = candles.length - 1;
        const updateLine = (series: ISeriesApi<"Line"> | null, arr: number[] | undefined) => {
          if (series && arr && arr[lastIdx] !== undefined && !isNaN(arr[lastIdx])) {
            series.update({ time: timeVal, value: arr[lastIdx] });
          }
        };
        updateLine(emaSeriesRef.current, indicators.ema20);
        updateLine(smaSeriesRef.current, indicators.sma50);
        updateLine(volumeMASeriesRef.current, indicators.volumeMA);
      }

      if (lastCandle.time > lastTimeRef.current) {
        lastTimeRef.current = lastCandle.time;
      }
    }
  }, [candles, indicators]);

  // 5. Markers
  useEffect(() => {
    if (!markersPluginRef.current) return;
    
    const toTime = (ms: number) => (timezoneEngine.utcToLocal(ms) / 1000) as UTCTimestamp;
    
    const seriesMarkers: SeriesMarker<Time>[] = markers.map(m => ({
      time: toTime(m.time),
      position: m.position,
      shape: m.shape,
      color: m.color,
      text: m.text,
    })).sort((a, b) => (a.time as number) - (b.time as number));

    markersPluginRef.current.setMarkers(seriesMarkers);
  }, [markers]);

  // 6. Overlays (Price Lines)
  useEffect(() => {
    if (!candleSeriesRef.current) return;
    const series = candleSeriesRef.current;
    const live = priceLinesRef.current;
    const nextIds = new Set(priceLines.map(l => l.id));

    // Remove old lines
    for (const [id, handle] of live) {
      if (!nextIds.has(id)) {
        series.removePriceLine(handle);
        live.delete(id);
      }
    }

    // Add/Update lines
    for (const line of priceLines) {
      const opts = {
        price: line.price,
        color: line.color,
        lineStyle: line.lineStyle ?? LineStyle.Dashed,
        lineWidth: 1 as 1 | 2 | 3 | 4,
        axisLabelVisible: true,
        title: line.title,
      };
      
      const existing = live.get(line.id);
      if (existing) {
        existing.applyOptions(opts);
      } else {
        live.set(line.id, series.createPriceLine(opts));
      }
    }
  }, [priceLines]);

  return <div ref={containerRef} className="w-full h-full" />;
}
