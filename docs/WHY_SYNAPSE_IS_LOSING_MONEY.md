# Why Synapse is Losing Money

This report ranks the root causes of the poor profitability identified during the comprehensive system audit.

## 1. Repeated Re-entry Bug (Overtrading) / Continuous Signals
- **Impact**: CRITICAL
- **Issue**: Strategies like `EMA Crossover` generate signals based on continuous states (e.g., `ema12Last > ema26Last`) rather than discrete crossover events. This results in the system firing a `LONG` or `SHORT` signal on every single candle while the condition is true. 
- **Evidence**: Database logs show 167 signals generated but only 3 trades executed (due to position locking). As soon as a position hits a stop loss, the system receives the same continuous signal on the next candle and immediately re-enters a losing trade at a worse price.
- **Code Location**: `src/strategy-engine/strategies/ema-crossover/index.ts` (lines 24-34).
- **Estimated Profit Impact**: Devastating. Guarantees "death by a thousand cuts" as the system repeatedly enters and gets stopped out in late trends.

## 2. Inflated Confidence Scores via Generic Logic
- **Impact**: HIGH
- **Issue**: `ConfidenceEngine` calculates confidence using global, generic trend states (e.g., +15 points if price < EMA20 < SMA50) rather than strategy-specific probabilistic accuracy.
- **Evidence**: Executed trades possessed 85% and 100% confidence scores, despite being late trend entries. The base score of 50 + generic trend confirmations easily exceeds the 75% threshold in `SignalPriorityEngine`, forcing the daemon to trade weak setups.
- **Code Location**: `src/strategy-engine/core/confidence-engine.ts` (lines 23-44).
- **Estimated Profit Impact**: High. Causes the priority engine to consistently select late, low-quality trades over precise, high-quality breakouts.

## 3. Extremely Tight Default Stop Losses
- **Impact**: HIGH
- **Issue**: Strategies that do not override SL/TP fall back to a default multiplier of the Average True Range (ATR). The default SL of `1.8 * atr` is resulting in an average stop loss distance of only `0.22%` from the entry price.
- **Evidence**: The closed trade had a holding time of just 1.82 minutes before hitting the SL. Cryptocurrencies frequently experience intraday noise exceeding 0.22%.
- **Code Location**: `src/strategy-engine/core/signal-generator.ts` (lines 61-68).
- **Estimated Profit Impact**: High. Trades are stopped out before the market thesis can develop. 

## 4. Lack of Spread and Fee Accounting
- **Impact**: MEDIUM
- **Issue**: Tight stop losses combined with high-frequency continuous entries magnify the impact of exchange fees and bid/ask spreads, ensuring negative expectancy.
- **Evidence**: The system calculates a theoretical positive RR of ~1.77, but real-world execution on 0.22% moves will be entirely consumed by fees and slippage.
- **Code Location**: `src/execution-engine/paper/index.ts`.
- **Estimated Profit Impact**: Medium. Accelerates capital drain during whipsaw market regimes.
