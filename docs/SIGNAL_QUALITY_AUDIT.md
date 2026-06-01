# Phase 3 — Signal Quality Audit

## Tracing
Strategy (`EMA Crossover`) → Signal (Continuous Bearish) → Confidence (`ConfidenceEngine` inflates to 85-100%) → Execution (`Daemon` executes immediately if no open position exists).

## Investigation
1. **Are low quality signals being traded?**
   Yes. Strategies like `EMA Crossover` emit signals continuously during a trend rather than at the exact crossover event. These are late, low-quality entries.
2. **Are confidence scores realistic?**
   No. They are highly inflated. The `ConfidenceEngine` uses generic trend indicators (EMA alignment, RSI, MACD) to add fixed points to a base score of 50. Any strong trend automatically pushes the score above 75%, regardless of strategy timing or probability.
3. **Are 75% confidence signals actually profitable?**
   No. All trades in the audit sample possessed >= 85% confidence and resulted in rapid stop-outs.
4. **Are confidence calculations inflated?**
   Yes. `ConfidenceEngine` adds points for state (e.g., `price < ema20` = +15) rather than empirical probability of success.
5. **Are HOLD signals ignored correctly?**
   Yes, the `SignalPriorityEngine` correctly filters out HOLD signals (`sig.signal !== "HOLD"`).
6. **Is the ranking engine selecting bad trades?**
   Yes. Because confidence scores are systematically inflated by generic trend indicators, the ranking engine prioritizes late-trend entries over early, precise strategy triggers.

# Phase 6 — Execution Audit

1. **Is highest confidence signal always executed?**
   Yes. `SignalPriorityEngine` sorts by confidence (`resolvedSetups.sort((a, b) => b.confidence - a.confidence)`).
2. **Is signal ranking working?**
   Yes, mechanically. However, it ranks based on flawed confidence calculations.
3. **Are strategies actually competing?**
   Yes, through the conflict resolution step in `StrategyEvaluator`.
4. **Is only one strategy executing?**
   Currently, only `EMA Crossover` executed trades because its continuous nature spams signals that dominate the queue.
5. **Is Central Engine hiding actual strategy?**
   No, the trade history correctly attributes the trade to `EMA Crossover Strategy`.
6. **Are all implemented strategies active?**
   Yes, they are registered in `StrategyRegistry`, but continuous signal strategies are monopolizing execution bandwidth.
