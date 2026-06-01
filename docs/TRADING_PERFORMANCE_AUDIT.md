# Phase 1 — Trade Performance Audit

## Key Metrics
1. **Total trades**: 3 (1 Closed, 2 Open)
2. **Win rate**: 0.00%
3. **Loss rate**: 100.00%
4. **Average winner**: $0.00
5. **Average loser**: -$2.24
6. **Profit factor**: 0.00
7. **Expectancy**: -$2.24
8. **Average holding time**: 1.82 minutes (rapid stop out)
9. **Long vs Short performance**: 
   - Longs: 0 (WR: 0%)
   - Shorts: 3 (WR: 0%)
10. **BTC vs ETH vs SOL performance**:
    - BTC: 1 trade (WR: 0%)
    - ETH: 1 trade (WR: 0%)
    - SOL: 1 trade (WR: 0%)

# Phase 2 — Strategy Audit

## Strategy Performance
| Strategy | Signals Generated | Trades Executed | Win Rate | Average ROI | Average PnL | Max Drawdown | Profit Factor |
|----------|------------------|-----------------|----------|-------------|-------------|--------------|---------------|
| EMA Crossover Strategy | 167 | 3 | 0% | -0.22% | -$2.24 | 100% | 0.00 |

*Note: Data reflects a limited runtime sample in the database.*

### Conclusion
- **Which strategies make money?**: None currently.
- **Which strategies lose money?**: EMA Crossover Strategy.
- **Which strategies should be disabled?**: EMA Crossover Strategy (until the continuous signal bug is fixed).

# Phase 4 — Risk Management Audit

1. **Actual Risk:Reward ratio**: 1.77
2. **Average stop loss distance**: 0.22%
3. **Average take profit distance**: 0.39%
4. **Are SL too tight?**: Yes, 0.22% is well within normal market noise for crypto.
5. **Are TP too small?**: Yes, 0.39% does not allow for meaningful trend capture.
6. **Are trades stopped before trend develops?**: Yes, average holding time is < 2 minutes.
7. **Is position sizing correct?**: Yes, based on user risk settings, but deployed inefficiently.

# Phase 5 — Market Regime Audit

- **Losing trades by regime**:
  - `Bearish Trend`: 3 trades (100% of losses)
- **Mismatch**: The trades were taken in the direction of the trend (Short in Bearish Trend), so there was no regime mismatch. The losses were due to late entry timing and tight stop losses.

# Phase 7 — Portfolio Audit

- **BTC**: Win rate 0% (1 loss)
- **ETH**: Win rate 0% (1 open loss)
- **SOL**: Win rate 0% (1 open loss)

# Phase 8 — Overtrading Audit

1. **Trades per day**: 3
2. **Trades per symbol**: 1
3. **Trades per strategy**: 3 (EMA Crossover)
4. **Cooldown effectiveness**: None. The system relies entirely on position locking to prevent duplicates.
5. **Duplicate entries**: Prevented by `existingOpen` check in daemon.
6. **Rapid re-entries**: Yes. Once a position is closed, the continuous signal immediately re-enters on the next candle.

**Is the system overtrading?**: Yes, primarily through rapid re-entries caused by continuous strategy signals.
