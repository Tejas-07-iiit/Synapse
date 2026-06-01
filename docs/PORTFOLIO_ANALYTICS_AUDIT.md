# Portfolio Analytics Audit & Redesign Report

This document reports the audit findings, bugs, root causes, formulas, and verification outputs for the Synapse Portfolio Analytics system.

---

## Phase 1 — Data Validation

We audited every metric on the Portfolio page to verify their formulas, database tables, and correctness.

### 1. Starting Capital
- **Formula**: `wallet.totalDeposited` (defaults to `$10,000.00` if 0/undefined).
- **Data Source**: Zustand store `useWalletStore`, fetched from GET `/api/wallet`.
- **Database Table**: `Wallet` table.
- **Query Used**: `prisma.wallet.findUnique({ where: { userId } })`
- **Correctness**: **Correct**. Represents the initial deposited capital baseline, which remains static.

### 2. Current Equity
- **Formula**: `wallet.balance + Unrealized PnL`
- **Data Source**: Zustand `useWalletStore` for settled balance, plus real-time mark-to-market calculations of open positions in `useMarketStore.tickerData`.
- **Database Table**: `Wallet` (for balance) and `Position` (for open positions).
- **Query Used**:
  - `prisma.wallet.findUnique({ where: { userId } })`
  - `prisma.position.findMany({ where: { userId, status: "OPEN" } })`
- **Correctness**: **Correct**. Accurately represents the total liquidated value of the portfolio at any given instant.

### 3. Realized Profit
- **Formula**: $\sum (\text{closedTrades.pnl})$
- **Data Source**: GET `/api/positions?userId=[id]&type=closed`
- **Database Table**: `Trade` table.
- **Query Used**: `prisma.trade.findMany({ where: { userId }, orderBy: { closedAt: "desc" } })`
- **Correctness**: **Correct**. Aggregates all finalized profits/losses from closed trades.

### 4. Unrealized Profit
- **Formula**: $\sum (\text{activePositions.pnl})$ calculated in real-time.
- **Data Source**: GET `/api/positions?userId=[id]&type=active` combined with WebSocket ticker data.
- **Database Table**: `Position` table.
- **Query Used**: `prisma.position.findMany({ where: { userId, status: "OPEN" } })`
- **Correctness**: **Correct**. Properly values floating positions against live exchange mark prices.

### 5. Equity Curve
- **Formula**: Cumulative equity starting with Starting Capital at $t_0$, incremented by each closed trade's PnL at its `closedAt` timestamp.
- **Data Source**: Derived client-side from Starting Capital and `closedTrades` list.
- **Database Table**: `Trade` and `Wallet`.
- **Query Used**: Same as closed trades and wallet.
- **Correctness**: **Incorrect (Bugs Found)**.
  - **Critical Bug #1**: Generated a synthetic/placeholder starting point at `now - 30 days` and fell back to `"2026-05-01"` during initial load, showing dates prior to system existence (e.g. `02 May 2025`).
  - **Critical Bug #2**: If only 1 closed trade existed, the chart plotted the starting capital and the single closed trade. Since the holding time of that trade was very short (1.8 minutes), it created a vertical spike on the chart time scale.

### 6. Drawdown Analytics
- **Formula**:
  - Max Drawdown: Largest drop percentage from peak equity to trough:
    $$\text{Max Drawdown \%} = \max \left( \frac{\text{Peak Equity} - \text{Equity}_t}{\text{Peak Equity}} \times 100 \right)$$
  - Current Drawdown: Drop percentage from absolute peak to current equity:
    $$\text{Current Drawdown \%} = \frac{\text{Peak Equity} - \text{Current Equity}}{\text{Peak Equity}} \times 100$$
  - Recovery Percentage: Progress from trough back to peak:
    $$\text{Recovery \%} = \frac{\text{Current Equity} - \text{Trough Value}}{\text{Peak Equity} - \text{Trough Value}} \times 100$$
- **Data Source**: Derived from equity curve values.
- **Database Table**: `Trade` and `Wallet`.
- **Correctness**: **Incorrect**. Math formulas are correct, but because the equity curve dates/points are contaminated by placeholder/collapsed timestamps, the derived drawdown values are inaccurate.

### 7. Strategy Performance
- **Formula**: Groups closed trades by `strategyName` to calculate Trades, Wins, Losses, Win Rate, Net Profit, Average ROI.
- **Database Table**: `Trade`.
- **Correctness**: **Correct**, but lacked the fallback layout when only 1 strategy is present.

### 8. Monthly Performance
- **Formula**: Groups closed trades by month-year.
- **Database Table**: `Trade`.
- **Correctness**: **Correct**, but requested to be deleted.

---

## Root Cause Analysis

### Critical Bug #1 — Legacy & Placeholder Timestamps
- **Root Cause**: The placeholder start point was generated using `new Date()` minus 30 days. When Zustand was loading, `wallet.totalDeposited` was `0`, triggering a fallback to `"2026-05-01"`. In environments where the year was shifted or parsed differently, this produced dates like `02 May 2025` which were prior to the first trade's existence.
- **Solution**: Completely remove synthetic start dates. Plot the initial starting point strictly at the `openedAt` timestamp of the first actual trade in the database.

### Critical Bug #2 — Vertical Spike & Single Trade Plotting
- **Root Cause**: The database contained exactly **1 closed trade** (duration of 1.8 minutes). Plotting the start point at its open time (`04:54:41`) and the end point at its close time (`04:56:31`) resulted in a compressed chart time scale showing a vertical spike.
- **Solution**: Enforce a safeguard that prevents rendering the chart if `filteredClosedTrades.length < 2`. Instead, render `"Insufficient historical data"`.

---

## Theme & Layout Redesign Decisions

- **Color Adaptability (Light/Dark Mode)**:
  - Removed all hardcoded navy/blue hex background and border codes (`#020617`, `#0f172a`, `#1e293b`).
  - Implemented standard Tailwind color tokens (`bg-background`, `bg-card`, `border-border`, `text-foreground`) to allow the portfolio interface to shift seamlessly when themes are toggled.
- **Dynamic Chart Theming**:
  - Leveraged `useTheme` from `next-themes` inside the `useEffect` render loop to adapt lightweight-charts grid colors, price scale lines, text labels, and active line colors based on the resolved browser theme.
- **Unified Spacing**:
  - Matched padding (`p-5`, `px-8 py-6`), border radius (`rounded-xl`, `rounded-[10px]`), and text sizing parameters across all cards to remain identical with the Trading Workspace layout.

---

## Verification Output

The following values were queried and calculated directly from the PostgreSQL database:

1. **First Trade Timestamp**: `2026-06-01T04:54:41.621Z` (Opened)
2. **Last Trade Timestamp**: `2026-06-01T04:56:31.073Z` (Closed)
3. **Starting Capital**: `$10,000.00`
4. **Realized PnL**: `-$2.24` (exactly `-$2.244122374479048`)
5. **Unrealized PnL**: `-$0.08` (exactly `-$0.07602220583783026`)
6. **Current Equity**: `$9,997.68` (exactly `$9,997.679855419683`)
7. **Drawdown Calculation**:
   - Max Drawdown: `-0.0224%`
   - Current Drawdown: `-0.0232%`
   - Recovery Percentage: `0.00%` (current equity is lower than closed trade trough due to open floating loss)
8. **Equity Curve Points**:
   - `Point 1 (Trade Open)`: `1780299281` (2026-06-01T04:54:41.621Z) -> Equity: `10000`
   - `Point 2 (Trade Close)`: `1780299391` (2026-06-01T04:56:31.073Z) -> Equity: `9997.7558`

