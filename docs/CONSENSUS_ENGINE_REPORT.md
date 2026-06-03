# Consensus-Based Trade Execution Report

Synapse has transitioned from a single-strategy, highest-confidence execution model to a robust, category-based **Consensus Execution Engine**. This document provides an overview of the design, strategy classifications, mathematical consensus calculations, fee-aware filters, and expected performance impacts.

---

## 1. Category Classification

All 33 trading strategies in the Synapse Strategy Registry have been categorized into one of four consensus categories based on their target timeframes, average holding times, and trading behavior.

| Category | Count | Strategies | Description |
|---|---|---|---|
| **SCALPING** | 15 | `ema-crossover`, `rsi-reversal`, `macd-momentum`, `bollinger-breakout`, `mean-reversion`, `momentum`, `grid`, `donchian-breakout`, `rally-base-drop`, `sr-sweep`, `bollinger-reversion`, `short-term-reversal`, `parabolic-rsi`, `range-breakout-high`, `residual-momentum` | Ultra-fast execution (1m/3m/5m timeframes, holding times under 45m). |
| **INTRADAY** | 11 | `dow-mfi-rsi`, `ema-cross-adx`, `hyper-supertrend`, `lorentzian`, `ma-crossover-var`, `sma-trend-filter`, `squeeze-momentum`, `t3-nexus`, `time-series-momentum`, `volatility-regime`, `wavetrend` | Day-trading setups (15m/30m/1h timeframes, holding times 1h-8h). |
| **SWING** | 5 | `golden-cross`, `hash-ribbons`, `heiken-ashi-swing`, `ichimoku-cloud`, `news-fear-greed` | Higher timeframe swing plays (1h/4h/Daily, holding times up to several days). |
| **DEFENSIVE** | 2 | `defensive`, `zeiierman-volatility` | Capital preservation and regime-aware safety filters. |

---

## 2. Consensus Calculation Methodology

When a new tick or candle close occurs:
1. **Signal Aggregation**: The Strategy Engine collects all non-`HOLD` signals generated for the current symbol.
2. **Category Grouping**: Signals are grouped by their `consensusCategory`.
3. **Directional Consensus**:
   - Within each category, we sum the number of `LONG` votes ($N_{long}$) and `SHORT` votes ($N_{short}$).
   - The winning direction is determined by the majority vote.
   - The Consensus Percentage is computed as:
     $$\text{Consensus Pct} = \frac{\max(N_{long}, N_{short})}{N_{long} + N_{short} + N_{hold}} \times 100$$
4. **Average Confidence**: The average confidence score of all strategies supporting the winning direction is calculated.
5. **Threshold Validation**: The category is only approved if both the Consensus % and Average Confidence meet their respective category thresholds.

---

## 3. Threshold Configuration

To ensure high-quality trade selection, each category has custom threshold criteria:

| Category | Min Consensus % | Min Avg Confidence |
|---|---|---|
| **SCALPING** | 60% | 65 |
| **INTRADAY** | 45% | 60 |
| **SWING** | 35% | 55 |
| **DEFENSIVE** | 30% | 50 |

---

## 4. Fee-Aware Scalp Profitability Filter

Scalping trades are highly sensitive to transaction fees. To prevent "fee bleed" (where trading fees eat up all potential profits), the Consensus Engine enforces a fee-efficiency filter for the **SCALPING** category before approving execution:

- **Maker/Taker Rate**: 0.1% ($0.001$) default fee per transaction (Binance standard).
- **Rule**: Expected gross profit must exceed **$2\times$** the estimated round-trip transaction fees.
- **Math**:
  $$\text{Expected Gross Profit} = |TP - Entry| \times Q$$
  $$\text{Total Fees} = (Entry \times Q \times 0.001) + (TP \times Q \times 0.001)$$
  $$\text{Condition}: \text{Expected Gross Profit} > 2 \times \text{Total Fees}$$

If a scalp signal fails this check, it is rejected with reason `FEE_INEFFICIENT_SCALP` and logged to the database for user transparency.

---

## 5. Expected Impact

- **Reduction in Trading Frequency**: By requiring consensus among strategies rather than executing the single top signal, overall trade volume will be reduced, eliminating low-probability trades.
- **Higher Win Rate**: Forcing multiple strategies (e.g. at least 60% of scalping strategies) to agree on direction filters out false breakouts and conflicting market noise.
- **Capital Protection**: The inclusion of defensive consensus and the fee-efficiency filter prevents over-trading during ranging regimes and avoids fee-draining trades.
