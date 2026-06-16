"use client";

import React, { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
  type IPriceLine,
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

export interface ChartPriceLine {
  id: string;
  price: number;
  color: string;
  lineStyle?: LineStyle;
  title: string;
}

interface McxPriceChartProps {
  data: ChartDataItem[];
  priceLines?: ChartPriceLine[];
  showIndicators?: {
    ema20?: boolean;
    ema50?: boolean;
    ema200?: boolean;
    bb?: boolean;
  };
  onCrosshairMove?: (hoveredItem: {
    time: Time;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    ema20: number | null;
    ema50: number | null;
    ema200: number | null;
  } | null) => void;
}

export default function McxPriceChart({
  data,
  priceLines = [],
  showIndicators = { ema20: true, ema50: true, ema200: false, bb: true },
  onCrosshairMove
}: McxPriceChartProps) {
  const { resolvedTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const firstTimeRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const dataHydratedRef = useRef<boolean>(false);
  const priceLinesRef = useRef<Map<string, IPriceLine>>(new Map());

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
      // Remove autoSize: true, we will handle resizing manually via ResizeObserver
    });

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });

    resizeObserver.observe(containerRef.current);
    // Initial size set
    handleResize();

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

      const cData = param.seriesData.get(candleSeries) as
        | { open: number; high: number; low: number; close: number }
        | undefined;
      const vData = param.seriesData.get(volumeSeries) as { value: number } | undefined;
      const e20 = param.seriesData.get(ema20Series) as { value: number } | undefined;
      const e50 = param.seriesData.get(ema50Series) as { value: number } | undefined;
      const e200 = param.seriesData.get(ema200Series) as { value: number } | undefined;

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

    const currentPriceLines = priceLinesRef.current;

    return () => {
      currentPriceLines.clear();
      resizeObserver.disconnect();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (!chartRef.current) return;

    // The data.time is already in seconds from the API.
    // Shift timestamps to local timezone so Lightweight Charts renders them in local time.
    const toTime = (t: number) => {
      const d = new Date(t * 1000);
      const localUtc = Date.UTC(
        d.getFullYear(),
        d.getMonth(),
        d.getDate(),
        d.getHours(),
        d.getMinutes(),
        d.getSeconds(),
        d.getMilliseconds()
      ) / 1000;
      return localUtc as UTCTimestamp;
    };
    const clearAllSeries = () => {
      candleSeriesRef.current?.setData([]);
      volumeSeriesRef.current?.setData([]);
      ema20SeriesRef.current?.setData([]);
      ema50SeriesRef.current?.setData([]);
      ema200SeriesRef.current?.setData([]);
      bbUpperSeriesRef.current?.setData([]);
      bbMiddleSeriesRef.current?.setData([]);
      bbLowerSeriesRef.current?.setData([]);
    };

    if (data.length === 0) {
      clearAllSeries();
      dataHydratedRef.current = false;
      firstTimeRef.current = 0;
      lastTimeRef.current = 0;
      return;
    }
    
    // Sort and remove duplicates by time to prevent Lightweight Charts assertions
    const sorted = [...data].sort((a, b) => a.time - b.time);
    const uniqueData: ChartDataItem[] = [];
    const seenTimes = new Set<number>();
    
    for (const item of sorted) {
      if (!seenTimes.has(item.time)) {
        uniqueData.push(item);
        seenTimes.add(item.time);
      }
    }

    if (uniqueData.length === 0) return;

    const currentFirstTime = uniqueData[0].time;
    const isNewDataset = !dataHydratedRef.current || currentFirstTime !== firstTimeRef.current;

    const mapLineData = (extractor: (item: ChartDataItem) => number | null) => {
      return uniqueData
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

    if (isNewDataset) {
      clearAllSeries();

      candleSeriesRef.current?.setData(
        uniqueData.map((item) => ({
          time: toTime(item.time),
          open: item.open,
          high: item.high,
          low: item.low,
          close: item.close,
        }))
      );

      volumeSeriesRef.current?.setData(
        uniqueData.map((item) => ({
          time: toTime(item.time),
          value: item.volume,
          color: item.close >= item.open ? "rgba(34, 197, 94, 0.25)" : "rgba(239, 68, 68, 0.25)",
        }))
      );

      ema20SeriesRef.current?.setData(mapLineData((i) => i.ema20));
      ema50SeriesRef.current?.setData(mapLineData((i) => i.ema50));
      ema200SeriesRef.current?.setData(mapLineData((i) => i.ema200));
      bbUpperSeriesRef.current?.setData(mapLineData((i) => i.bbUpper));
      bbMiddleSeriesRef.current?.setData(mapLineData((i) => i.bbMiddle));
      bbLowerSeriesRef.current?.setData(mapLineData((i) => i.bbLower));

      dataHydratedRef.current = true;
      firstTimeRef.current = currentFirstTime;
      lastTimeRef.current = uniqueData[uniqueData.length - 1].time;
      // Fit content only when changing commodity/dataset
      setTimeout(() => {
        if (chartRef.current) {
          // Force scale recalculation 
          chartRef.current.priceScale("right").applyOptions({ autoScale: true });
          chartRef.current.timeScale().fitContent();
        }
      }, 50);
      return;
    }

    const last = uniqueData[uniqueData.length - 1];
    if (last.time < lastTimeRef.current) return;

    candleSeriesRef.current?.update({
      time: toTime(last.time),
      open: last.open,
      high: last.high,
      low: last.low,
      close: last.close,
    });

    volumeSeriesRef.current?.update({
      time: toTime(last.time),
      value: last.volume,
      color: last.close >= last.open ? "rgba(34, 197, 94, 0.25)" : "rgba(239, 68, 68, 0.25)",
    });

    const updateLine = (series: ISeriesApi<"Line"> | null, value: number | null) => {
      if (!series || value === null || Number.isNaN(value)) return;
      series.update({ time: toTime(last.time), value });
    };
    updateLine(ema20SeriesRef.current, last.ema20);
    updateLine(ema50SeriesRef.current, last.ema50);
    updateLine(ema200SeriesRef.current, last.ema200);
    updateLine(bbUpperSeriesRef.current, last.bbUpper);
    updateLine(bbMiddleSeriesRef.current, last.bbMiddle);
    updateLine(bbLowerSeriesRef.current, last.bbLower);

    if (last.time > lastTimeRef.current) {
      lastTimeRef.current = last.time;
    }
  }, [data]);

  // 5. Overlays (Price Lines)
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
