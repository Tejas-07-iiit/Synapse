# Portfolio Equity Curve Audit

> **Date**: 2026-06-01
> **Target Component**: `app/portfolio/page.tsx`

## Phase 1 — Data Source Audit

**1. Raw Database Records:**
Data originates from the PostgreSQL database via two Next.js API calls:
- `fetch(/api/positions?userId=X&type=active)` -> maps to `activePositions` state.
- `fetch(/api/positions?userId=X&type=closed)` -> maps to `closedTrades` state.

**2. Transformed Chart Points:**
Inside `useMemo(() => { ... }, [filteredClosedTrades, startingCapital])`, the code sorts `closedTrades` by `closedAt`. It then initializes the curve with a starting point:
```typescript
{ time: sortedTrades[0].openedAt, value: startingCapital }
```
Then iterates through the sorted trades, accumulating PnL:
```typescript
currentVal += trade.pnl;
curve.push({ time: trade.closedAt, value: currentVal });
```

**3. Final Chart Dataset:**
The dataset is passed to `lightweight-charts` via `lineSeries.setData(sortedPoints)`.

## Phase 2 — Verify Equity Calculation

**Formula Verification**: 
The system correctly calculates `Current Equity = wallet.balance + unrealizedPnL` for the dashboard metric.
For the chart, it calculates `currentVal += trade.pnl` starting from `startingCapital`. 

**Calculations are mathematically correct**, but the *starting point* logic is flawed. The initial deposit should be point 0, but injecting `sortedTrades[0].openedAt` creates time sequence mismatches.

## Phase 3 — Verify Timestamp Ordering

**Ordering Validation**: **FAILED**
- Lightweight Charts requires `time` to be **strictly ascending** (no duplicates, no backwards jumps).
- If two trades hit Take Profit or Stop Loss at the exact same second, `Math.floor(closedAt / 1000)` produces duplicate timestamps.
- If `sortedTrades[0].openedAt` is somehow equal to or evaluated incorrectly relative to other trades, it causes backward time jumps.
- **Result**: The library attempts to connect the dots out of chronological order, resulting in lines crossing themselves or complete rendering failure.

## Phase 4 — Remove Fake Data

- The code does not contain hardcoded mock arrays like `[100, 105, ... ]`.
- However, the "fake data" visual effect is caused by the line connecting backwards across the timeline due to the timestamp sorting bug, making the equity curve look completely unrealistic (impossible zig-zags through time).

## Phase 5-8 Requirements

The chart must be rebuilt using `AreaSeries` for the blue gradient fill, smooth curves (Curved line type), strict timestamp deduplication, exact x-axis date formatting based on the selected filter, and proper empty-state handling if fewer than 2 trades exist.