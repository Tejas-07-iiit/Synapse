# Risk Management V2 (Dynamic SL/TP & Enforced RR)

This document describes the dynamic, volatility-aware Stop Loss (SL) and Take Profit (TP) system implemented in Synapse, ensuring trades survive standard market noise and enforce mathematically positive trade expectancy.

---

## 1. Problem with the Old Logic

In the initial audit, we found:
- **Average Stop Loss**: `~0.22%`
- **Average Take Profit**: `~0.39%`
- **Estimated Hold Time**: `< 2 minutes` before hitting the SL.

**Cause**: Strategies fell back to a default `1.8 * ATR` multiplier, which on lower timeframes (e.g. 5m/15m) produced extremely tight boundaries that fell well within normal cryptocurrency price noise. Trades were stopped out rapidly before the market thesis had any chance to develop.

---

## 2. Dynamic SL/TP Bounds

We centralized and rebuilt the boundary calculations in `SignalGenerator.createSignal()` to adapt dynamically to the market regime and volatility (measured via Bollinger Band width `bbWidth` and Average True Range `ATR`):

| Volatility State | Indicator Trigger | Stop Loss Distance | Take Profit Distance | Target Risk-to-Reward (RR) |
|---|---|---|---|---|
| **Low Volatility** | `bbWidth < 0.02` or `Low Volatility` regime | `1.0 * ATR` | `2.0 * ATR` | **1:2.0** |
| **Normal Volatility** | Default / `Ranging` or `Trending` regime | `1.5 * ATR` | `3.75 * ATR` | **1:2.5** |
| **High Volatility** | `bbWidth > 0.08` or `High Volatility` / `Breakout` regime | `2.0 * ATR` | `6.0 * ATR` | **1:3.0** |

---

## 3. Strict 1.5x Risk-Reward Enforcement

To guarantee positive mathematical expectancy across all strategy types, the system enforces a strict minimum Risk-Reward check on *all* generated signals, including those where strategies try to manually override SL/TP boundaries.

Before returning the final signal contract, the engine checks:
$$\text{Risk} = | \text{Entry Price} - \text{Stop Loss} |$$
$$\text{Reward} = | \text{Take Profit} - \text{Entry Price} |$$
$$\text{RR Ratio} = \frac{\text{Reward}}{\text{Risk}}$$

- If the computed **$\text{RR Ratio} < 1.5$**:
  - The Take Profit is adjusted to force a minimum $1.5\text{x}$ reward relative to the stop-loss risk.
  - For a **LONG** signal: `takeProfit = entry + risk * 1.5`
  - For a **SHORT** signal: `takeProfit = entry - risk * 1.5`
  - A reasoning note is appended: `"Take Profit adjusted to enforce minimum 1.5x Risk-to-Reward ratio."`

This ensures that under no circumstances can a trade execute with a sub-optimal Risk-Reward ratio, preventing negative expectancy during whipsaw market conditions.
