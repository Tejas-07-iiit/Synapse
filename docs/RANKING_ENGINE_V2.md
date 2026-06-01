# Execution Ranking Engine V2 (Final Score)

This document describes the multi-factor `Final Score` ranking system implemented in the Synapse trading engine. It replaces raw confidence-based prioritization to ensure only the highest-quality setups execute.

---

## 1. Problem with the Old Logic

In the initial audit:
- The system prioritized signals strictly by sorting raw confidence scores: `resolvedSetups.sort((a, b) => b.confidence - a.confidence)`.
- Because confidence scores were inflated by generic indicators and spammy continuous signals (like EMA Crossover), the ranking engine consistently prioritized low-quality late-trend trades.
- This starved capital from other registered strategies, even if they had much higher historical win rates.

---

## 2. Rebuilt Final Score Calculation

We modified the priority engine in [src/strategy-engine/core/signal-priority.ts](file:///home/tejas-ambaliya/Desktop/Synapse1/src/strategy-engine/core/signal-priority.ts) to compute a multi-factor **`Final Score`** for every compatible strategy signal.

The score combines raw entry logic with real-world historical success, market alignment, and volume dynamics:

$$\text{Final Score} = \text{Raw Confidence} + \text{Strategy Performance Weight} + \text{Regime Compatibility Bonus} + \text{Volume Confirmation Bonus}$$

### A. Raw Confidence (0 to 100)
Calculated by the rebuilt `ConfidenceEngine` using structured point allocations for trend, momentum, volume, and indicators.

### B. Strategy Performance Weight (-35 to +15)
Retrieved dynamically from `PerformanceWeightingEngine.getStrategyBoost(strategyId)` based on the strategy's database win rate, profit factor, recent performance, and drawdown.
- Highly profitable strategies receive up to **+15 points** boost.
- Underperforming or loss-making strategies receive up to a **-35 points** penalty.

### C. Regime Compatibility Bonus (0 to 10)
Boosts signals that align with the current market condition:
- **Perfect Match** (e.g. Trend strategy in TRENDING regime): **+10 points**
- **Partial Match** (e.g. Lorentzian machine learning strategy): **+5 points**
- **No Bonus**: **+0 points**

### D. Volume Confirmation Bonus (0 to 10)
Boosts signals if the current trading volume validates a breakout or reversal:
- `Volume > 1.5 * VolumeMA`: **+10 points**
- Else: **+0 points**

---

## 3. Prioritization & Threshold Filters

To prevent capital allocation to lower-quality signals, we split the filter into two layers:
1. **Raw Confidence Safeguard**: A setup must possess a raw confidence of at least **60%** to prevent trading garbage signals.
2. **Final Score Priority**: The setup's `Final Score` must clear a threshold of **75%**.

Signals are sorted by `Final Score` descending, and the highest-scoring unique setup per symbol is selected for execution.

### Advantages
- **Adaptability**: Prevents a failing strategy from execution by penalizing its ranking priority.
- **Fair Competition**: Allows other strategies to execute, resolving queue monopolization.
- **High Conviction**: Combines volume, regime compatibility, and historic profit data to maximize expectancy.
