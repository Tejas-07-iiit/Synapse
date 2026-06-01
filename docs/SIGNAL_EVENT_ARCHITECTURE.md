# Signal Event Architecture & De-duplication

This document explains the architecture implemented to resolve the **Repeated Re-entry Bug (Overtrading)** in the Synapse autonomous trading engine.

---

## 1. The Continuous Signal Problem (Root Cause)

Historically, strategies in Synapse evaluated signals based on the active **market state** (continuous conditions) rather than discrete **market events**. 

For example, the EMA Crossover strategy checked if `FastEMA > SlowEMA`. If true, it generated a `LONG` signal. This state remains true across multiple consecutive candles during a trend. While position locking prevented the engine from opening multiple concurrent positions for a single symbol, the moment a position was closed (e.g., hitting a tight stop-loss), the engine would see the continuous `LONG` signal on the next candle and immediately re-enter the trend at a progressively worse price.

This caused a "death by a thousand cuts" loop, generating excessive stop-out losses during late trend stages.

---

## 2. Event-Based Crossover Triggers

To address this, we transitioned the core trading strategies from continuous state evaluations to **discrete event crossover triggers**:

### A. EMA Crossover Strategy
- **Bullish Crossover (LONG)**: Triggered only when the Fast EMA crosses *above* the Slow EMA on the latest candle.
  $$\text{Previous EMA12} \le \text{Previous EMA26} \quad \text{and} \quad \text{Current EMA12} > \text{Current EMA26}$$
- **Bearish Crossover (SHORT)**: Triggered only when the Fast EMA crosses *below* the Slow EMA on the latest candle.
  $$\text{Previous EMA12} \ge \text{Previous EMA26} \quad \text{and} \quad \text{Current EMA12} < \text{Current EMA26}$$
- Returns `HOLD` otherwise.

### B. MACD Momentum Strategy
- **MACD Crossover (LONG/SHORT)**: Triggers strictly when the MACD Line crosses above/below the Signal Line.
- Removed continuous histogram confirmation fallbacks that previously triggered orders on every candle.

### C. RSI Reversal Strategy
- **Boundary Crossover (LONG/SHORT)**: Triggers `LONG` only when the RSI crosses above the `30` oversold boundary from below, and `SHORT` only when the RSI crosses below the `70` overbought boundary from above.
- Returns `HOLD` otherwise.

---

## 3. Central Signal De-duplication

As a secondary safety net, we implemented a centralized de-duplication mechanism at the engine level in [src/strategy-engine/core/engine.ts](file:///home/tejas-ambaliya/Desktop/Synapse1/src/strategy-engine/core/engine.ts).

### Mechanism
- The `StrategyEngine` maintains an in-memory cache of the last non-HOLD signal direction emitted:
  ```typescript
  private lastEmittedSignals: Map<string, "LONG" | "SHORT"> = new Map();
  ```
- The cache key is constructed dynamically as:
  $$\text{Key} = \text{strategyId} + \text{"_"} + \text{symbol} + \text{"_"} + \text{timeframe}$$
- When a strategy generates a `LONG` or `SHORT` signal, the engine compares it to the cache:
  - If the new signal matches the cached direction, it is converted to `HOLD` with confidence `0` and reasoning: `"Duplicate suppressed: same direction as last emitted signal"`.
  - If the new signal direction has changed (e.g., from `LONG` to `SHORT`), it is allowed to pass, and the cache is updated.

This ensures that under no circumstances can a strategy fire consecutive duplicate signals for a symbol, completely preventing re-entry spam.
