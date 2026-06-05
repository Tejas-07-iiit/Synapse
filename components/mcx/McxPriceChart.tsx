"use client";

import React, { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { useTheme } from "next-themes";

interface ChartDataItem {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  ema20: number | null;
  ema50: number | null;
  ema200: number | null;
  bbUpper: number | null;
  bbMiddle: number | null;
  bbLower: number | null;
}

interface McxPriceChartProps {
  data: ChartDataItem[];
  showIndicators?: {
    ema20?: boolean;
    ema50?: boolean;
    ema200?: boolean;
    bb?: boolean;
  };
  onCrosshairMove?: (hoveredItem: any | null) => void;
}

export default function McxPriceChart({
  data,
  showIndicators = { ema20: true, ema50: true, ema200: false, bb: true },
  onCrosshairMove
}: McxPriceChartProps) {
  const { resolvedTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const firstTimeRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const dataHydratedRef = useRef<boolean>(false);

  // Series refs
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const ema20SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ema50SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ema200SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbUpperSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbMiddleSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbLowerSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  // 1. Chart initialization
  useEffect(() => {
    if (!containerRef.current) return;

    const isDark = resolvedTheme === "dark";
    const colors = {
      bg: "transparent",
      text: isDark ? "#d1d5db" : "#4b5563",
      grid: isDark ? "rgba(249, 115, 22, 0.04)" : "rgba(249, 115, 22, 0.02)",
      border: isDark ? "rgba(249, 115, 22, 0.1)" : "rgba(249, 115, 22, 0.08)",
      crosshair: "rgba(249, 115, 22, 0.4)",
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
      },
      timeScale: {
        borderColor: colors.border,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 12,
        barSpacing: 8,
        minBarSpacing: 1,
        fixLeftEdge: true,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: colors.crosshair,
          labelBackgroundColor: "#f97316",
        },
        horzLine: {
          color: colors.crosshair,
          labelBackgroundColor: "#f97316",
        },
      },
      autoSize: true,
    });

    // Candlesticks
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
      priceFormat: { type: "price", precision: 2, minMove: 0.05 },
    });

    // Volume
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });

    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    // Indicator Lines
    const ema20Series = chart.addSeries(LineSeries, {
      color: "#3b82f6",
      lineWidth: 2,
      visible: !!showIndicators.ema20,
    });

    const ema50Series = chart.addSeries(LineSeries, {
      color: "#eab308",
      lineWidth: 2,
      visible: !!showIndicators.ema50,
    });

    const ema200Series = chart.addSeries(LineSeries, {
      color: "#a855f7",
      lineWidth: 2,
      visible: !!showIndicators.ema200,
    });

    const bbUpperSeries = chart.addSeries(LineSeries, {
      color: "rgba(249, 115, 22, 0.4)",
      lineWidth: 1,
      lineStyle: 2, // dashed
      visible: !!showIndicators.bb,
    });

    const bbMiddleSeries = chart.addSeries(LineSeries, {
      color: "rgba(249, 115, 22, 0.25)",
      lineWidth: 1,
      lineStyle: 2,
      visible: !!showIndicators.bb,
    });

    const bbLowerSeries = chart.addSeries(LineSeries, {
      color: "rgba(249, 115, 22, 0.4)",
      lineWidth: 1,
      lineStyle: 2,
      visible: !!showIndicators.bb,
    });

    // Subscribe to crosshair move
    chart.subscribeCrosshairMove((param) => {
      if (!onCrosshairMove) return;
      if (!param.time || param.point === undefined || !param.seriesData.get(candleSeries)) {
        onCrosshairMove(null);
        return;
      }

      const cData = param.seriesData.get(candleSeries) as any;
      const vData = param.seriesData.get(volumeSeries) as any;
      const e20 = param.seriesData.get(ema20Series) as any;
      const e50 = param.seriesData.get(ema50Series) as any;
      const e200 = param.seriesData.get(ema200Series) as any;

      onCrosshairMove({
        time: param.time,
        open: cData?.open ?? 0,
        high: cData?.high ?? 0,
        low: cData?.low ?? 0,
        close: cData?.close ?? 0,
        volume: vData?.value ?? 0,
        ema20: e20?.value ?? null,
        ema50: e50?.value ?? null,
        ema200: e200?.value ?? null,
      });
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    ema20SeriesRef.current = ema20Series;
    ema50SeriesRef.current = ema50Series;
    ema200SeriesRef.current = ema200Series;
    bbUpperSeriesRef.current = bbUpperSeries;
    bbMiddleSeriesRef.current = bbMiddleSeries;
    bbLowerSeriesRef.current = bbLowerSeries;

    return () => {
      chart.applyOptions({ autoSize: false });
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      ema20SeriesRef.current = null;
      ema50SeriesRef.current = null;
      ema200SeriesRef.current = null;
      bbUpperSeriesRef.current = null;
      bbMiddleSeriesRef.current = null;
      bbLowerSeriesRef.current = null;
      dataHydratedRef.current = false;
    };
  }, []);

  // 2. Sync Theme
  useEffect(() => {
    if (!chartRef.current) return;
    const isDark = resolvedTheme === "dark";
    const colors = {
      text: isDark ? "#d1d5db" : "#4b5563",
      grid: isDark ? "rgba(249, 115, 22, 0.04)" : "rgba(249, 115, 22, 0.02)",
      border: isDark ? "rgba(249, 115, 22, 0.1)" : "rgba(249, 115, 22, 0.08)",
      crosshair: "rgba(249, 115, 22, 0.3)",
    };

    chartRef.current.applyOptions({
      layout: { textColor: colors.text },
      grid: {
        vertLines: { color: colors.grid },
        horzLines: { color: colors.grid },
      },
      rightPriceScale: { borderColor: colors.border },
      timeScale: { borderColor: colors.border },
    });
  }, [resolvedTheme]);

  // 3. Indicator Visibility Sync
  useEffect(() => {
    ema20SeriesRef.current?.applyOptions({ visible: !!showIndicators.ema20 });
    ema50SeriesRef.current?.applyOptions({ visible: !!showIndicators.ema50 });
    ema200SeriesRef.current?.applyOptions({ visible: !!showIndicators.ema200 });
    bbUpperSeriesRef.current?.applyOptions({ visible: !!showIndicators.bb });
    bbMiddleSeriesRef.current?.applyOptions({ visible: !!showIndicators.bb });
    bbLowerSeriesRef.current?.applyOptions({ visible: !!showIndicators.bb });
  }, [
    showIndicators.ema20,
    showIndicators.ema50,
    showIndicators.ema200,
    showIndicators.bb
  ]);

  // 4. Load Data
  useEffect(() => {
    if (!chartRef.current || data.length === 0) return;

    const toTime = (t: number) => Math.floor(t / 1000) as UTCTimestamp;
    const sorted = [...data].sort((a, b) => a.time - b.time);

    const currentFirstTime = sorted[0].time;
    const isNewDataset = !dataHydratedRef.current || currentFirstTime !== firstTimeRef.current;

    // Set full data to keep standard candle history, volume, and indicator lines aligned
    candleSeriesRef.current?.setData(
      sorted.map((item) => ({
        time: toTime(item.time),
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
      }))
    );

    volumeSeriesRef.current?.setData(
      sorted.map((item) => ({
        time: toTime(item.time),
        value: item.volume,
        color: item.close >= item.open ? "rgba(34, 197, 94, 0.25)" : "rgba(239, 68, 68, 0.25)",
      }))
    );

    const mapLineData = (extractor: (item: ChartDataItem) => number | null) => {
      return sorted
        .map((item) => {
          const val = extractor(item);
          if (val === null || isNaN(val)) return null;
          return {
            time: toTime(item.time),
            value: val,
          };
        })
        .filter(Boolean) as { time: UTCTimestamp; value: number }[];
    };

    ema20SeriesRef.current?.setData(mapLineData((i) => i.ema20));
    ema50SeriesRef.current?.setData(mapLineData((i) => i.ema50));
    ema200SeriesRef.current?.setData(mapLineData((i) => i.ema200));
    bbUpperSeriesRef.current?.setData(mapLineData((i) => i.bbUpper));
    bbMiddleSeriesRef.current?.setData(mapLineData((i) => i.bbMiddle));
    bbLowerSeriesRef.current?.setData(mapLineData((i) => i.bbLower));

    if (isNewDataset) {
      dataHydratedRef.current = true;
      firstTimeRef.current = currentFirstTime;
      // Fit content only when changing commodity/dataset
      setTimeout(() => {
        chartRef.current?.timeScale().fitContent();
      }, 100);
    }
  }, [data]);

  return <div ref={containerRef} className="w-full h-full" />;
}
