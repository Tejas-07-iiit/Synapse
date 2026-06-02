# Production Readiness Verification Checklist (Synapse)

## 1. Engine Integrity (24/7 Core)
- [ ] **Daemon Lifecycle**: Verify `pm2 status` shows `synapse-trading-daemon` is online with 0 restarts.
- [ ] **WebSocket Continuity**: Check `logs/heartbeat.log` for `wsConnected: true` every minute.
- [ ] **REST Fallback**: Verify `market-engine.ts` can recover candles via REST if WS drops.

## 2. Signal Pipeline (Traceability)
- [ ] **Data to Signal**: Ensure `1m, 3m, 5m` candles are processed and logged in `logs/trading.log`.
- [ ] **Ranking Validation**: Verify `SignalPriorityEngine` is applying Performance Boosts correctly.
- [ ] **Filter Transparency**: Check `prisma.tradeSignal` for `blocked: true` entries with clear `blockReason`.

## 3. Mode Architecture (Isolation)
- [ ] **Scalping Isolation**: Verify a `SCALPING` user **never** receives a trade from a `15m` signal.
- [ ] **Intraday Isolation**: Verify an `INTRADAY` user **never** receives a trade from a `1m` signal.
- [ ] **Timeout Enforcement**: Verify Scalping trades close strictly at `45m` and Intraday at `8h`.

## 4. Risk & Math (Correctness)
- [ ] **ATR-Based SL/TP**: Manually verify a trade's SL/TP in `logs/execution.log` matches `Entry +/- (ATR * Multiplier)`.
- [ ] **Dynamic Sizing**: Verify trade size in USDT correlates with the Signal Confidence Score.
- [ ] **Correlation Filter**: Verify no concurrent trades in the same direction on different assets for one user.

## 5. System Recovery
- [ ] **Restart Recovery**: Restart daemon and verify all `OPEN` positions are re-loaded into memory within 10s.
- [ ] **Database Integrity**: Ensure no "Unknown argument" or "Missing column" errors in `logs/errors.log`.

## 6. Admin Diagnostics
- [ ] **Health API**: Access `/api/admin/diagnostics` and verify `daemonStatus: "ACTIVE"`.
- [ ] **Throughput Check**: Verify `candlesProcessed10m` is > 0.
