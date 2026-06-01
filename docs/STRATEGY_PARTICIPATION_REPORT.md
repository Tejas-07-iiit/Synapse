# Strategy Participation Audit Report

This report documents the audit of strategy registration, enablement, evaluation, and execution in the Synapse trading engine. It clarifies why only the `EMA Crossover Strategy` previously dominated executed trades, and verifies that all strategies are now positioned to participate.

---

## 1. Auditing Strategy Execution Status

We traced each strategy through the execution pipeline:

| Strategy | Registered? | Enabled? | Evaluated? | Signals Generated? | Executed? | Status / Findings |
|---|---|---|---|---|---|---|
| **EMA Crossover** | Yes | Yes | Yes | Yes (Continuous) | Yes | **Overactive**. Continuous state evaluation spammed signals on every candle, monopolizing position locks and queue slots. |
| **MACD Momentum** | Yes | Yes | Yes | Yes (Continuous) | No | **Suppressed**. Continuous signal evaluations were active, but confidence was often filtered out or out-prioritized. |
| **RSI Reversal** | Yes | Yes | Yes | Yes (Continuous) | No | **Suppressed**. Signals were generated, but counter-trend setups lacked generic trend alignment confirmations and failed to beat the raw confidence filter. |
| **Other Strategies** | Yes | Yes | Yes | Yes (Occasional) | No | **Discarded**. Precise breakout or mean-reversion setups lacked trend alignment, keeping their confidence scores below the flat 75% threshold in the priority engine. |

---

## 2. Root Causes of Strategy Monopolization

1. **Continuous Signal Spam**:
   The `EMA Crossover Strategy` emitted signals continuously. When a position was locked, these signals were discarded in the execution engine. However, the moment a position closed, the queue was immediately flooded by the continuous signal on the next candle. This closed out execution slots for other strategies.
   
2. **Generic Confidence Inflation**:
   The `ConfidenceEngine` calculated confidence using generic indicators (e.g., adding 15 points if the price aligns with the 20 EMA/50 SMA trend). Consequently, strategies that align with trends (like EMA Crossover) had their scores inflated to 85–100%, while counter-trend or breakout strategies had low scores (< 75%) and were filtered out by the priority engine.

3. **Flat Confidence Filtering**:
   The `SignalPriorityEngine` applied a flat confidence threshold of 75%. Because other strategies calculate confidence realistically or did not get generic trend boosts, their setups were discarded.

---

## 3. Remediation & Participation Verification

We implemented the following updates to ensure all strategies can participate:

1. **State-to-Event Re-factoring**:
   Spammy strategies (`EMA Crossover`, `MACD Momentum`, `RSI Reversal`) were refactored to emit signals only on discrete **crossover events**.
   
2. **Centralized De-duplication**:
   Enforced a de-duplication cache in `StrategyEngine` that rejects consecutive duplicate signals of the same direction.

3. **Confidence Rebuild**:
   Rebuilt the confidence calculations to weigh Regime Match, Volatility, and Volume alongside Trend. Trend alignment now accounts for only 25% of the score rather than being the dominant factor, allowing counter-trend and breakout strategies to achieve high confidence scores when market conditions are appropriate.

4. **Regime Compatibility Filters**:
   Signals are matched against active market regimes (e.g. Trend strategies only in trending regimes, Mean Reversion in ranging regimes). Mismatched strategies are rejected, ensuring that ranging strategies can trade ranging markets without competing with trending strategies.

5. **Dynamic Performance & Priority Ranking**:
   The priority engine now ranks signals using a `Final Score` that incorporates dynamic historical win rates and regime matching, preventing any single strategy from dominating the pipeline.
