# Market Regime Filtering

This document describes the regime-aware strategy filter implemented in the Synapse trading engine. It prevents strategies from executing signals in incompatible market conditions.

---

## 1. Mismatch Risk (Root Cause)

Historically, strategies evaluated market setups regardless of the broader macro market condition. 
- **Trend-following strategies** (like EMA Crossover) kept buying and selling during flat, consolidating ranges, suffering from rapid whipsaw stop-outs.
- **Mean-reversion strategies** (like Bollinger Band Reversion or RSI Reversal) kept trading reversals during strong breakout trends, resulting in massive drawdown as price continued to push past limits.

The audit identified that matching strategies to regime categories is critical to preventing capital erosion.

---

## 2. Regime Classification

The `RegimeEngine` dynamically classifies the market on every tick into one of six categories:
1. **`TRENDING`**: Strong trending market (Bullish or Bearish slope).
2. **`RANGING`**: Sideways consolidating market.
3. **`BREAKOUT`**: Volatility expansion with high volume.
4. **`LIQUIDITY_SWEEP`**: Sweep of support/resistance bounds.
5. **`ACCUMULATION`**: Ranging with bottom-level buying signatures.
6. **`DISTRIBUTION`**: Ranging with top-level selling signatures.

---

## 3. Compatibility Matrix

In [src/strategy-engine/core/signal-priority.ts](file:///home/tejas-ambaliya/Desktop/Synapse1/src/strategy-engine/core/signal-priority.ts), the priority engine evaluates compatibility for every incoming trade setup before resolving conflicts:

| Classified Market Regime | Allowed Strategy Categories | Allowed Examples |
|---|---|---|
| **`TRENDING`** | `Trend Following`, `Sentiment`, `Defensive`, `Lorentzian` | EMA Crossover, WaveTrend, Lorentzian |
| **`RANGING` / `ACCUMULATION` / `DISTRIBUTION`** | `Reversal`, `Mean-Reversion`, `Grid`, `Defensive`, `Lorentzian` | RSI Reversal, Mean Reversion, Grid |
| **`BREAKOUT`** | `Breakout`, `Volatility`, `Lorentzian` | Bollinger Breakout, Squeeze Momentum |
| **`LIQUIDITY_SWEEP`** | `LiquiditySweep`, `SupplyDemand`, `Lorentzian` | Support/Resistance Sweep, Rally Base Drop |

If a generated signal is from a strategy that is incompatible with the prevailing regime:
- The signal is neutralized: `sig.signal = "HOLD"`, `sig.signalType = "HOLD"`, `sig.confidence = 0`.
- It is flagged with metadata: `sig.blocked = true`, `sig.blockReason = "Regime mismatch"`.

This ensures that the engine only executes strategies in their target market environments, protecting capital in adverse conditions.
