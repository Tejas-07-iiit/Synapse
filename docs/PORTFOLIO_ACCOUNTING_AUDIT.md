# Synapse Portfolio Accounting Audit Report

**Date**: 2026-06-02  
**Audit Scope**: Wallet Balance, Net Profitability, Trade History PnL, Portfolio Equity Curve  
**Target Files**: `src/server/daemon.ts`, `src/execution-engine/paper/index.ts`, `app/api/positions/route.ts`, `app/portfolio/page.tsx`, `app/trade-history/page.tsx`

---

## Executive Summary

A critical accounting audit was performed on the Synapse trading workspace following reports of severe inconsistencies between:
1. **Wallet Balance** ($10,011.426 for Account A)
2. **Net Profitability** (-$0.97 for Account A)
3. **Trade History PnL** (-$0.97 for Account A)
4. **Portfolio Equity Curve** (ends at $9,999.03 for Account A)

The audit revealed three major categories of root causes:
1. **Client-Server Dual Execution (Race Conditions)**: The frontend client (browser) and the server trading daemon both run independent WebSocket execution monitors. When Stop Loss (SL) or Take Profit (TP) conditions are met, both attempt to close the position. The API endpoint does not validate if a position is already closed, resulting in duplicate trade logs and double-updates to the wallet balance.
2. **Leverage Calculation Inconsistencies**: Floating PnL calculations in the browser and daemon double-multiply by leverage because the asset quantity is already scaled by leverage during order sizing. Closed PnL calculations apply leverage only once. This causes open positions' PnL to be exaggerated, which drops immediately upon closure.
3. **Fragile Database Transactions**: In the daemon, the database calls are not wrapped in a single database transaction. If `prisma.trade.create` fails, the error is caught and ignored, but the wallet balance update still executes, causing the wallet balance to drift from the actual sum of trades.

The overall severity of these findings is **CRITICAL** due to direct impacts on financial accounting correctness, wallet balances, and user-facing dashboards.

---

## 1. Root Causes & Exact Files Involved

### Issue A: Simultaneous Client-Server Dual Execution
- **Root Cause**: Both the client-side Next.js app running in the browser and the server-side PM2 daemon run independent `marketEngine` price feeds subscribing to the Binance WebSocket. When price updates hit a position's SL or TP limit:
  1. The server daemon detects it and updates the DB directly using its Prisma `dbHandler.closePosition()`.
  2. The browser client detects it and sends an HTTP POST request to `/api/positions` with `action: "close"`.
  3. The Next.js API endpoint `/api/positions` does not check if the position's status is already `CLOSED` in the database; it blindly executes the position update, logs a second duplicate trade in `Trade` table, and increments `wallet.balance` a second time.
- **Files Involved**:
  - `src/server/daemon.ts` (directly updates wallet and trade on daemon detection)
  - `app/api/positions/route.ts` (API route handling browser's close request)
  - `src/execution-engine/paper/index.ts` (runs `updatePrices` and calls `closePosition` on both client and daemon environments)
  - `src/market-engine/market-engine.ts` (subscribes to websocket on both client and daemon)

### Issue B: Double-Leverage Multiplier Bug
- **Root Cause**: Position sizing in `openPosition` scales the asset `quantity` by `leverage` to get the notional position size:
  `orderValueUsdt = balance * (riskPerTradePct / 100) * leverage;`
  `qty = orderValueUsdt / price;`
  Because `quantity` is already scaled by leverage, the PnL calculated as `(exitPrice - entryPrice) * quantity` is already leveraged.
  However, `updatePrices` (floating PnL), `app/portfolio/page.tsx` (unrealized PnL), and `app/trade-history/page.tsx` (active positions PnL) multiply the result by `leverage` *again*, resulting in **double-leverage** for open positions.
  Conversely, `closePosition` (settled PnL) calculates the closed PnL as `exitVal - entryVal` (or `entryVal - exitVal`) without multiplying by leverage, which is single-leveraged (correct).
- **Files Involved**:
  - [src/execution-engine/paper/index.ts](file:///home/tejas-ambaliya/Desktop/Synapse1/src/execution-engine/paper/index.ts#L106-L110) (`updatePrices` floating PnL calculation)
  - [app/portfolio/page.tsx](file:///home/tejas-ambaliya/Desktop/Synapse1/app/portfolio/page.tsx#L279-L281) (`unrealizedPnL` calculation)
  - [app/trade-history/page.tsx](file:///home/tejas-ambaliya/Desktop/Synapse1/app/trade-history/page.tsx#L253-L255) (`unifiedTrades` active positions mapping)

### Issue C: Out-of-Transaction Updates and Swallowed Errors
- **Root Cause**: In the daemon's `closePosition` DB handler, `prisma.trade.create` is wrapped in a `try-catch` block, but `prisma.wallet.update` is outside the block. If trade logging fails (e.g. database constraint/field error), it is caught, logged as a database warning, and ignored, while the wallet balance is still updated. This leads to drift between wallet balance and trade logs. Additionally, these calls are not executed inside a Prisma transaction (`$transaction`), risking partial execution.
- **Files Involved**:
  - [src/server/daemon.ts](file:///home/tejas-ambaliya/Desktop/Synapse1/src/server/daemon.ts#L137-L193) (database handler registration for `closePosition`)

### Issue D: Equity Curve Reconstruction Limitations
- **Root Cause**: The system has no `WalletSnapshot` or `EquitySnapshot` table to log actual historical wallet balances. The Portfolio page reconstructs the equity curve client-side by starting with `$10,000` capital and adding the trade PnLs chronologically. Any cash balance drift, double-updates to the wallet, deposits, or withdrawals are omitted from the chart, causing it to display `$9,999.03` while the card shows `$10,011.426`.
- **Files Involved**:
  - [app/portfolio/page.tsx](file:///home/tejas-ambaliya/Desktop/Synapse1/app/portfolio/page.tsx#L300-L330) (`equityCurveData` generation)

---

## 2. Incorrect Formulas

### 1. Floating PnL (Double-Leveraged)
- **Incorrect Formula** (`src/execution-engine/paper/index.ts` L106-110, `app/portfolio/page.tsx` L279-281):
  $$Floating\ PnL = (Current\ Price - Entry\ Price) \times Quantity \times Leverage$$
- **Correct Formula** (since `Quantity` already incorporates leverage):
  $$Floating\ PnL = (Current\ Price - Entry\ Price) \times Quantity$$

### 2. Settled PnL (Unleveraged Closed Position)
- **Incorrect Formula** (`src/execution-engine/paper/index.ts` L484-491):
  $$Closed\ PnL = (Exit\ Price - Entry\ Price) \times Quantity$$
  *Note: While mathematically correct because Quantity incorporates leverage, this formula is inconsistent with the floating PnL formula which multiplies by leverage again.*

### 3. Net Profitability Card Definition Mismatch
- **Portfolio Page** (`app/portfolio/page.tsx` L291):
  $$Net\ Profitability = \sum (t.netPnl\ or\ t.pnl)\ \text{for closed trades only}$$
- **Trade History Page** (`app/trade-history/page.tsx` L415):
  $$Net\ Profitability = \sum (t.netPnl\ or\ t.pnl)\ \text{for closed trades} + \sum (p.pnl)\ \text{for open positions}$$

---

## 3. Duplicate Execution Audit Evidence

1. **Simultaneous WebSocket Listeners**:
   - The Next.js client-side code subscribes to kline/ticker feeds and calls `PaperTradingEngine.updatePrices` on the user's browser.
   - The daemon process running on PM2 also subscribes to the same feeds and calls `PaperTradingEngine.updatePrices` on the server.
2. **Duplicate Trade History Logs**:
   - As shown in Screenshot 2, the trade history table for Account A contains identical records:
     - `SOLUSDT SHORT` closed on `6/1/2026 10:15 AM` at price `$80.6981` (TP HIT) with PnL `+$3.39` appears twice.
     - `BTCUSDT LONG` closed on `5/29/2026 09:05 PM` at price `$73,020.16` (STOPPED) with PnL `-$2.77` appears twice.
3. **Double Wallet Increments**:
   - Because the position status is updated to `CLOSED` concurrently by both the daemon and the API endpoint, the wallet balance is incremented twice by `netPnl`, causing cash balance drift.

---

## 4. Cross-Validation & Mismatch Table

For each account, starting capital defaults to $10,000.00. The following table highlights the inconsistencies between the settled wallet balance and the sum of trades in the database:

| Account | Starting Capital | Current Wallet Balance | Expected Net Profit (Wallet - Starting) | UI Net Profitability (Realized PnL Sum) | Mismatch (Expected vs. UI) | Severity |
|---|---|---|---|---|---|---|
| **Account A (tejas 1)** | \$10,000.00 | \$10,011.426 | **+\$11.426** | **-\$0.97** | **+\$12.396** | **CRITICAL** |
| **Account B (tejas 2)** | \$10,000.00 | \$10,010.908 | **+\$10.908** | **+\$3.48** | **+\$7.428** | **CRITICAL** |
| **Account C (tejas 3)** | \$10,000.00 | \$9,998.985 | **-\$1.015** | **-\$11.55** | **+\$10.535** | **CRITICAL** |

---

## 5. Summary of Severity Levels

| Component | Inconsistency / Bug | Severity | Description |
|---|---|---|---|
| **Execution Engine** | Double websocket processing client/server | **CRITICAL** | Causes duplicate close requests, creating multiple trades and updating the wallet balance twice. |
| **Database Actions** | No transaction lock on close action | **HIGH** | The `/api/positions` route doesn't verify if a position is already closed before saving a trade and updating the wallet. |
| **PnL Formula** | Double leverage multiplier | **HIGH** | Exaggerates floating open position PnL by the leverage factor (e.g. 5x) compared to settled PnL. |
| **Wallet Updates** | Swallowed errors on trade create | **HIGH** | If logging a trade fails in the daemon, the wallet balance is still modified, creating data drift. |
| **Portfolio Chart** | Reconstructed client-side equity curve | **MEDIUM** | The chart plots trades from trade history instead of database wallet snapshots, resulting in a chart that doesn't match the actual wallet balance. |
| **UI Metrics** | Net Profitability definition mismatch | **LOW** | Portfolio and Trade History pages show different calculations for cards with the same label. |
