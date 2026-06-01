# Dynamic Strategy Performance Weighting

This document explains the dynamic strategy performance weighting system implemented in Synapse to weight and rank signals based on empirical performance.

---

## 1. Problem with the Old Logic

Previously, all strategy signals were treated as equal. A strategy with a `0%` historical win rate (such as `EMA Crossover` under state evaluation) had the same execution priority as a highly calibrated machine learning setup, provided its confidence score cleared the threshold.

This caused the engine to continuously execute failing setups while starving capital from more profitable strategies.

---

## 2. Rebuilt Performance Weighting Engine

We created `PerformanceWeightingEngine` at [src/strategy-engine/core/performance-weighting.ts](file:///home/tejas-ambaliya/Desktop/Synapse1/src/strategy-engine/core/performance-weighting.ts) to calculate a dynamic performance score (0 to 100) for each strategy by analyzing historical trade records in the database.

### Scoring Criteria

The performance score is calculated using four distinct weighted metrics:
1. **Win Rate (WR) (40%)**:
   $$Score_{WR} = \frac{\text{Wins}}{\text{Total Trades}} \times 100$$
2. **Profit Factor (PF) (30%)**:
   $$\text{Profit Factor} = \frac{\text{Gross Profit}}{\text{Gross Loss}}$$
   The Profit Factor is clamped between `0.0` and `3.0`.
   $$Score_{PF} = \frac{\text{Clamped PF}}{3.0} \times 100$$
3. **Recent Performance (RP) (20%)**:
   Evaluates the win rate of the last 5 trades to adapt to recent market condition changes.
   $$Score_{RP} = \text{Recent Win Rate} \times 100$$
4. **Drawdown (DD) (10%)**:
   Tracks the peak-to-trough drop of cumulative strategy PnL.
   $$Score_{DD} = \max(0, 100 - \text{Max Drawdown Percent} \times 5)$$

### Final Compound Performance Score
$$\text{Performance Score} = 0.4 \cdot Score_{WR} + 0.3 \cdot Score_{PF} + 0.2 \cdot Score_{RP} + 0.1 \cdot Score_{DD}$$

- **Baseline Score**: A strategy starts with a baseline score of **70**.
- **Strategy Boost**: Calculated as:
  $$\text{Boost} = \frac{\text{Performance Score} - 70}{2}$$
  - A strategy with a perfect score (100) receives a **+15.0** boost to its signal ranking priority.
  - A strategy with a poor score (e.g. 0) receives a **-35.0** penalty, making it highly unlikely to execute unless no other signals exist.
  - A strategy with no trades defaults to the baseline score (70) and receives a **0.0** boost.

---

## 3. Operations & Lifecycle

- **Boot Synchronization**: On daemon startup, `PerformanceWeightingEngine.updatePerformanceScores()` is executed to calculate and cache initial weights from database trade logs.
- **Dynamic Recalculation**: Whenever a position is closed and a trade is logged, the daemon triggers an asynchronous recalculation in the background to update the cache.
- **Dynamic Prioritization**: The priority engine reads these cached boost values during every tick execution, modifying the signal priorities on the fly.
