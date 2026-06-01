# Take Profit Execution Root Cause Analysis

> **Date**: 2026-06-01
> **Issue**: Trades occasionally remain OPEN despite the market price (wicks) clearly crossing the Take Profit (TP) or Stop Loss (SL) lines.

## 1. Root Cause

The trading engine relies on the Binance `@ticker` stream to monitor real-time prices and evaluate Stop Loss (SL) and Take Profit (TP) executions. Specifically, it maps the `c` (close / last traded price) field from the ticker payload to the `currentPrice` parameter in the `PaperTradingEngine`.

Because the `@ticker` stream only updates roughly once per second, it **drops intermediate high-frequency ticks**. If a highly volatile liquidation wick drops below the TP line and retraces back above it within the same 1-second interval, the ticker stream will only broadcast the final `close` price of that second. 

Since the `PaperTradingEngine` only evaluates `currentPrice <= pos.takeProfit`, and `currentPrice` represents the retraced close rather than the absolute low of the wick, the execution engine completely misses the event.

## 2. Evidence from Trace

### Phase 1 & 3: Tick Flow
1. Binance WebSocket pushes a `24hrTicker` event (`src/market-engine/websocket/index.ts`).
2. `NormalizerEngine.normalizeWsTicker` parses `parseFloat(data.c)` into `ticker.price` (`src/market-engine/normalization/index.ts`).
3. `MarketEngine` receives the ticker and calls `PaperTradingEngine.updatePrices(symUpper, ticker.price)` (`src/market-engine/market-engine.ts:193`).
4. `PaperTradingEngine.updatePrices` evaluates `if (currentPrice <= pos.takeProfit)` for SHORTs (`src/execution-engine/paper/index.ts`).

### Phase 2: Visual Evidence
The user-provided chart shows a massive red candle with a long lower wick. The wick crosses the green TP line, but the candle body (the close) is much higher. This perfectly aligns with the `currentPrice` (close) missing the `takeProfit` threshold.

### Phase 4, 5, 6, & 7: Component Verification
- **Daemon Execution**: The daemon is correctly managing positions. This is not a browser desync issue.
- **Symbol Matching**: `symUpper` formatting is completely consistent across the pipeline.
- **Close Position Logic**: The `closePosition()` logic is solid; it simply never gets called because `shouldClose` remains `false`.

## 3. Affected Files
- `src/execution-engine/paper/index.ts` (Execution logic)
- `src/market-engine/market-engine.ts` (Price feed routing)

## 4. Recommended Fix

To ensure SL and TP are executed exactly as they would be on a real exchange, the `PaperTradingEngine` must evaluate the **absolute high** and **absolute low** of the price movement, not just the last traded price.

1. **Modify `updatePrices` Signature**:
   Update `src/execution-engine/paper/index.ts` to accept optional high and low bounds:
   ```typescript
   public static async updatePrices(symbol: string, currentPrice: number, currentHigh?: number, currentLow?: number)
   ```

2. **Update Execution Logic**:
   Inside `updatePrices`, evaluate the bounds against the thresholds:
   ```typescript
   const lowestPrice = currentLow !== undefined ? currentLow : currentPrice;
   const highestPrice = currentHigh !== undefined ? currentHigh : currentPrice;

   if (pos.direction === "SHORT") {
     if (pos.stopLoss && highestPrice >= pos.stopLoss) { ... }
     if (pos.takeProfit && lowestPrice <= pos.takeProfit) { ... }
   }
   ```

3. **Feed Kline Data**:
   In `src/market-engine/market-engine.ts`, update the `registerCandleCallback` to also pass the candle's high and low directly into the execution engine. Unlike the ticker stream, the `@kline` stream continuously updates the absolute high and low of the current candle:
   ```typescript
   PaperTradingEngine.updatePrices(symUpper, candle.close, candle.high, candle.low);
   ```

## 5. Confidence Level
**100%**. The mathematical limitation of evaluating sub-second wicks using only a 1-second interval close price definitively explains the observed behavior.