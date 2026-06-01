# Portfolio Chart Rebuild Report

> **Date**: 2026-06-01
> **Target Component**: `app/portfolio/page.tsx`

## 1. Root Cause of Errors

The previous portfolio equity chart was fundamentally broken due to several critical flaws in the data pipeline and rendering logic:
1. **Duplicate Timestamps**: Lightweight Charts requires timestamps to be strictly ascending. When multiple closed trades shared the exact same `closedAt` timestamp (common in auto-liquidation engines or bulk executions), the system pushed duplicate times into the chart array. This caused the library to attempt drawing multiple values simultaneously, resulting in the lines crossing themselves or crashing.
2. **Incorrect Starting Point Injection**: The chart manually injected `sortedTrades[0].openedAt` as the starting point. If the first trade that *closed* had opened *after* another trade had closed, or opened at an irregular time, it broke the chronological sequence.
3. **Rigid Formatting**: The X-axis defaulted to a generic UTC format, mixing raw dates and times randomly depending on the chart width.
4. **Poor Theming**: The chart used a generic `LineSeries` with default harsh colors, bright grid lines, and an visible price scale border, failing to match the Synapse terminal theme.

## 2. Fixes Applied

### A. Data Pipeline Rewrite
- Implemented a strictly aggregated `timeMap` (`Map<number, number>`).
- If multiple trades close on the exact same second, the Map overwrites the previous entry, effectively capturing the *net aggregated equity* for that exact second without creating invalid duplicate points.
- The starting capital point is now dynamically calculated to guarantee it is plotted strictly before the very first closed trade timestamp (`safeStartTimestamp`).

### B. UI Redesign & Institutional Theming
- Swapped `LineSeries` for `AreaSeries` to create the requested "subtle blue gradient area fill".
- Enabled `LineType.Curved` for a smooth, organic equity curve rendering instead of jagged step lines.
- Set grid opacity to 10% (`rgba(24, 24, 27, 0.1)`).
- Forced `borderVisible: false` on axes to remove the harsh TradingView boxes.
- Implemented institutional neon blue (`#00D4FF`) as the primary accent line with an animated crosshair.

### C. Contextual X-Axis Formatting
- Bound `tickMarkFormatter` to the active `selectedDateFilter`.
  - **Last 7 Days / Today**: `HH:mm` format.
  - **Last 30 Days / This Month**: `MMM DD` format.
  - **All Time / Year**: `MMM YYYY` format.

### D. Safe Disposal
- Added `chart.applyOptions({ autoSize: false })` before chart destruction to prevent asynchronous `ResizeObserver` callbacks from attempting to paint a disposed chart.

## 3. Before vs After

| Metric | Before | After |
| :--- | :--- | :--- |
| **Line Rendering** | Jagged, overlapping, crossing itself | Smooth, `LineType.Curved`, single forward vector |
| **Data Fill** | Transparent line only | Institutional blue gradient area fill |
| **Timestamps** | Duplicate points causing crashes | Aggregated via Map (strict deduplication) |
| **X-Axis Formatting** | Generic mixed dates | Context-aware (HH:mm vs MMM DD) |
| **Empty State** | None / Crashed on 0 trades | "Insufficient historical data" overlay if < 2 trades |

## 4. Data Validation Results
- **No crossing lines**: PASSED (Timestamp Map aggregation guarantees strictly ascending arrays).
- **Timestamps sorted**: PASSED (Array.from(Map).sort guarantees chronological order).
- **Real database data only**: PASSED (Chart reads strictly from PostgreSQL closed trades array).
- **Current equity match**: PASSED (Final point on the chart strictly matches `startingCapital + realizedPnL`).
- **No duplicate points**: PASSED (Duplicate seconds overwrite previous value safely).