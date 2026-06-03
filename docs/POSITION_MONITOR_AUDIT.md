# POSITION MONITOR CALLPATH AUDIT

This document traces every execution path that triggers position monitoring and SL/TP evaluations in the Synapse trading engine.

---

## Calls to `PaperTradingEngine.updatePrices()`

### 1. Live Ticker WebSocket Updates
* **File**: `src/market-engine/market-engine.ts`
* **Function**: `registerWebSocketCallbacks`
* **Trigger**: Ticker price update from the `@ticker` stream
* **Timeframe**: Live tick (no candle timeframe)
* **Source**: Binance WebSocket live ticker price stream
* **Call Chain**:
  `Binance Ticker message`
  → `marketWsService` ticker callback
  → `MarketEngine.registerWebSocketCallbacks()` (lines 206-216)
  → `PaperTradingEngine.updatePrices(symUpper, ticker.price)`

---

### 2. Candle/Kline WebSocket Updates
* **File**: `src/market-engine/market-engine.ts`
* **Function**: `registerWebSocketCallbacks`
* **Trigger**: Kline/candle update or close from the `@kline_<timeframe>` streams
* **Timeframe**: `1m`, `3m`, `5m`, `15m`, `30m`, `1h` (all active timeframes simultaneously)
* **Source**: Binance WebSocket candle update streams
* **Call Chain**:
  `Binance Kline message`
  → `marketWsService` candle callback
  → `MarketEngine.registerWebSocketCallbacks()` (lines 220-271)
  → `PaperTradingEngine.updatePrices(symUpper, candle.close, candle.high, candle.low)`

---

## Price Check Logic inside `updatePrices`

* **File**: `src/execution-engine/paper/index.ts`
* **Function**: `updatePrices`
* **Price Source**:
  * For Ticker updates: Uses the live tick price (`currentPrice`).
  * For Candle updates: Uses the candle close (`currentPrice`), candle high (`currentHigh`), and candle low (`currentLow`).
* **Timeframe Context**:
  * Before the fix, the function had no knowledge of which timeframe generated the update. It evaluated all open positions against the passed high/low candle wicks of any timeframe, causing timeframe cross-contamination.
