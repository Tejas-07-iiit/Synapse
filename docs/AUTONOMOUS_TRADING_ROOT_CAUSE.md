# Autonomous Trading Root Cause Analysis

> **Date**: 2026-06-01  
> **Scope**: Complete trace of daemon → MarketEngine → StrategyEngine → PaperTradingEngine → Database  
> **Goal**: Determine exactly why autonomous trading stops when user logs out or closes browser

---

## Executive Summary

The daemon (`src/server/daemon.ts`) is architecturally sound in concept but has **7 critical bugs** caused by Zustand frontend stores being used as the source of truth inside the server-side execution path. When the daemon runs in headless Node.js mode, these stores contain **default values** (not database values), causing a cascading chain of silent failures that prevent all trades from executing.

> [!CAUTION]
> **The core problem: The daemon never crashed. It ran 24/7. But every single trade attempt was silently rejected because Zustand stores returned `autoTrading: false` and `balance: 0`.**

---

## Complete Execution Path Trace

```
daemon.ts starts
    ↓
registers PaperTradingEngine.dbHandler (Prisma) ✅ WORKS
registers strategyEngine.dbHandler (Prisma)     ✅ WORKS
loads all user positions from DB                 ✅ WORKS
    ↓
calls marketEngine.init("BTCUSDT", "15m")
    ↓
  MarketEngine reads useAuthStore.getState().user?.id
  → user is null (nobody logged in) → falls back to "default-user-id"     ❌ BUG #1
    ↓
  loads positions for "default-user-id" (no real user)                     ⚠️ REDUNDANT
  fetches historical candles from Binance REST API                         ✅ WORKS
  connects WebSocket to Binance                                            ✅ WORKS
  registers candle/ticker callbacks                                        ✅ WORKS
    ↓
[Every 5m/15m candle close]
    ↓
  MarketEngine.onCandleClose() → recalculate()
    ↓
  strategyEngine.processTick()                                             ✅ WORKS
  → calculates indicators                                                  ✅ WORKS
  → runs all strategies                                                    ✅ WORKS
  → generates signals                                                      ✅ WORKS
    ↓
  processTick() fires callbacks:
    ↓
  CALLBACK 1: MarketEngine constructor callback
    → updates Zustand marketStore (harmless in daemon)                     ✅ HARMLESS
    ↓
  CALLBACK 2: Daemon callback (daemon.ts L247)
    → queries DB: prisma.userSettings.findMany({autoTrading: true})        ✅ WORKS
    → for each user: loads wallet from DB                                  ✅ WORKS
    → INJECTS wallet/settings into Zustand stores                          ❌ BUG #2
    → calls PaperTradingEngine.openPosition()
      ↓
      openPosition() reads useWalletStore.getState()                       ❌ BUG #3
      openPosition() reads useSettingsStore.getState()                     ❌ BUG #3
      → calculates position size = wallet.balance × riskPct
        (Zustand may have stale/wrong values from race condition)
      ↓
      openPosition() calls fetch("/api/positions?userId=...")               ❌ BUG #4
      → RELATIVE URL fails in Node.js (no origin) → caught silently
      ↓
      openPosition() calls RiskEngine.validateOrder()
      → RiskEngine reads useSettingsStore.getState()                       ❌ BUG #5
      → checks settings.autoTrading (may be false from race condition)
      → if false: REJECTS TRADE with "Auto-trading is currently disabled"
      ↓
      openPosition() calls dbHandler.openPosition() (Prisma)               ✅ WORKS (if reached)
    ↓
  AFTER callbacks return, recalculate() continues:
    ↓
  reads useSettingsStore.getState()                                        ❌ BUG #6
  → autoTrading may be true (set by daemon callback for last user)
  reads useAuthStore.getState().user?.id → "default-user-id"               ❌ BUG #7
  → opens DUPLICATE trades for non-existent "default-user-id"
```

---

## The 7 Critical Bugs

### BUG #1 — MarketEngine reads useAuthStore for user ID

**File**: [market-engine.ts:L114](file:///home/tejas-ambaliya/Desktop/Synapse1/src/market-engine/market-engine.ts#L114)
```typescript
const targetUserId = useAuthStore.getState().user?.id || "default-user-id";
```

**Problem**: In daemon mode, `useAuthStore` is never populated. `user` is always `null`. Falls back to phantom user `"default-user-id"`.

**Impact**: Positions loaded and trades executed for a non-existent user.

---

### BUG #2 — Daemon injects settings into shared global Zustand singleton

**File**: [daemon.ts:L288-L303](file:///home/tejas-ambaliya/Desktop/Synapse1/src/server/daemon.ts#L288-L303)
```typescript
useWalletStore.setState({ balance: wallet.balance, ... });
useSettingsStore.setState({ autoTrading: settings.autoTrading, ... });
```

**Problem**: Zustand stores are **shared global singletons**. The daemon iterates over multiple users, overwriting the same store for each user. If User A has `balance: $5000` and User B has `balance: $200`, after processing both users the store contains User B's values. But `openPosition()` is async — by the time User A's `openPosition()` reads the store, it may already contain User B's values.

**Impact**: Race condition. Wrong wallet balance used for position sizing. Trades placed with wrong user's risk settings.

---

### BUG #3 — PaperTradingEngine.openPosition() reads Zustand stores directly

**File**: [paper/index.ts:L214-L215](file:///home/tejas-ambaliya/Desktop/Synapse1/src/execution-engine/paper/index.ts#L214-L215)
```typescript
const wallet = useWalletStore.getState();
const settings = useSettingsStore.getState();
```

**Problem**: These are Zustand stores with **defaults**:
- `useWalletStore`: `balance: 0`
- `useSettingsStore`: `autoTrading: false`, `riskPerTradePct: 2.0`

If the daemon's Zustand injection (BUG #2) has a race condition or hasn't executed yet, `openPosition()` calculates:
```
orderValueUsdt = 0 × (2.0 / 100) × 1 = $0.00
```

Result: `[POSITION_REJECTED] Invalid position size calculated: $0.00. Aborting.`

**Impact**: Trades silently rejected with zero position size.

---

### BUG #4 — PaperTradingEngine double-check uses relative fetch()

**File**: [paper/index.ts:L192](file:///home/tejas-ambaliya/Desktop/Synapse1/src/execution-engine/paper/index.ts#L192)
```typescript
const res = await fetch(`/api/positions?userId=${encodeURIComponent(userId)}`);
```

**Problem**: This is a **relative URL**. In Node.js daemon mode, there is no browser origin. `fetch("/api/...")` throws `TypeError: Failed to parse URL from /api/positions`. The error is caught silently (line 205-207), but the database consistency check is **completely bypassed**.

**Impact**: In-memory state is the only source of truth for position locks. If daemon restarts, position locks are lost, potentially opening duplicate positions.

---

### BUG #5 — RiskEngine reads useSettingsStore directly

**File**: [risk/index.ts:L15](file:///home/tejas-ambaliya/Desktop/Synapse1/src/execution-engine/risk/index.ts#L15)
```typescript
const settings = useSettingsStore.getState();
```

And then at [risk/index.ts:L31-L42](file:///home/tejas-ambaliya/Desktop/Synapse1/src/execution-engine/risk/index.ts#L31-L42):
```typescript
const isAutoTradingEnabled = settings.autoTrading || 
  process.env.NEXT_PUBLIC_AUTONOMOUS_TRADING === "true" || 
  process.env.NEXT_PUBLIC_AUTONOMOUS_TRADING === "on";

if (!isAutoTradingEnabled) {
  return { allowed: false, reason: "Auto-trading is currently disabled" };
}
```

**Problem**: If Zustand's `autoTrading` is `false` (the default) AND the env var is not set, **ALL trades are blocked** by the risk engine. The daemon injects `autoTrading: true` into Zustand before calling `openPosition()`, but the injection is to a shared global store with race condition risk.

**Impact**: Risk engine silently rejects all autonomous trades.

---

### BUG #6 — MarketEngine.recalculate() has its own autonomous execution path

**File**: [market-engine.ts:L347-L420](file:///home/tejas-ambaliya/Desktop/Synapse1/src/market-engine/market-engine.ts#L347-L420)
```typescript
const settings = useSettingsStore.getState();
...
const isAutonomous = settings.autoTrading || 
  process.env.NEXT_PUBLIC_AUTONOMOUS_TRADING === "true";
...
if (isAutonomous) {
  const targetUserId = useAuthStore.getState().user?.id || "default-user-id";
  await PaperTradingEngine.openPosition(targetUserId, ...);
}
```

**Problem**: This is a **SECOND execution path** for autonomous trading that runs AFTER the daemon's callback. After the daemon callback sets `autoTrading: true` in Zustand for the last user processed, this code reads that value and attempts to open a DUPLICATE trade for `"default-user-id"`.

**Impact**: Ghost trades for non-existent user. Potential double-entry for the same signal.

---

### BUG #7 — Dual execution path creates ghost "default-user-id" trades

**Files**: [market-engine.ts:L353](file:///home/tejas-ambaliya/Desktop/Synapse1/src/market-engine/market-engine.ts#L353) and [market-engine.ts:L386](file:///home/tejas-ambaliya/Desktop/Synapse1/src/market-engine/market-engine.ts#L386)

**Problem**: Both lines resolve user ID as:
```typescript
const targetUserId = useAuthStore.getState().user?.id || "default-user-id";
```

In daemon mode, `useAuthStore.getState().user` is always `null`. The system opens positions for `"default-user-id"` — a user that doesn't exist in the database.

**Impact**: Database errors (foreign key violation on `userId`), or phantom position records.

---

## Answers to 10 Diagnostic Questions

| # | Question | Answer | Evidence |
|---|---------|--------|----------|
| 1 | Does strategy evaluation continue when no users are online? | **YES** | `strategyEngine.processTick()` runs on candle close, independent of users. Triggered by WebSocket data. |
| 2 | Does market data continue updating when no users are online? | **YES** | `marketWsService.connect()` maintains a persistent WebSocket to Binance in the daemon process. |
| 3 | Does signal generation continue when browser is closed? | **YES** | Signal generation happens inside `StrategyEngine.processTick()`, running in the daemon's Node.js process. |
| 4 | Does daemon depend on Zustand state populated by frontend? | **YES ❌** | `PaperTradingEngine.openPosition()` reads `useWalletStore` (balance=0 default) and `useSettingsStore` (autoTrading=false default). `RiskEngine` reads `useSettingsStore`. `MarketEngine.recalculate()` reads `useAuthStore` and `useSettingsStore`. |
| 5 | Does daemon depend on current logged-in user? | **YES ❌** | `MarketEngine.init()` line 114 reads `useAuthStore.getState().user?.id`. Falls back to `"default-user-id"` in daemon mode. |
| 6 | Does daemon depend on websocket clients being connected? | **NO** | Daemon has its own WebSocket client via `marketWsService` singleton, separate from any browser connections. |
| 7 | Does daemon lose access to settings after logout? | **N/A** | Daemon never had real settings. It injects them from DB into Zustand, but with race conditions (BUG #2). |
| 8 | Does daemon stop receiving candle data after logout? | **NO** | WebSocket connection is in the daemon process. User logout affects only the browser. |
| 9 | Does autonomous execution require a browser session? | **YES ❌** | Without browser: `useSettingsStore.autoTrading = false` → RiskEngine rejects. `useWalletStore.balance = 0` → position sizing fails. Unless env var override is set. |
| 10 | Does any code path use frontend stores as source of truth? | **YES ❌** | `PaperTradingEngine.openPosition()` L214-215, `RiskEngine.validateOrder()` L15, `MarketEngine.recalculate()` L348, L353, L371, L386 — all read Zustand stores directly. |

---

## Chain of Silent Failure (Why No Trades Execute)

```
1. Daemon starts → Zustand stores have DEFAULT values
   └─ useSettingsStore.autoTrading = false
   └─ useWalletStore.balance = 0
   └─ useAuthStore.user = null

2. Candle closes → strategies run → signals generated ✅

3. Daemon callback fires → queries DB for autoTrading users ✅
   └─ injects wallet/settings into Zustand ✅ (but race-prone)
   └─ calls PaperTradingEngine.openPosition()
       └─ reads useWalletStore.getState().balance
          └─ MAY read stale value due to async race → $0 → REJECTED
       └─ reads useSettingsStore.getState().autoTrading  
          └─ MAY read stale false due to async race → REJECTED by RiskEngine
       └─ calls fetch("/api/positions") for double-check
          └─ FAILS (relative URL in Node.js) → caught silently

4. recalculate() continues after callbacks:
   └─ reads useSettingsStore → autoTrading = true (from daemon injection)
   └─ reads useAuthStore → user = null → "default-user-id"
   └─ attempts trade for phantom user → DB foreign key violation → REJECTED
```

**Result**: Signals generate. Strategies evaluate. But ZERO trades actually execute.

---

## Files Requiring Modification

| File | Issue | Fix Required |
|------|-------|-------------|
| [market-engine.ts](file:///home/tejas-ambaliya/Desktop/Synapse1/src/market-engine/market-engine.ts) | Dual execution path, useAuthStore/useSettingsStore reads | Remove autonomous execution from recalculate() — daemon handles it |
| [paper/index.ts](file:///home/tejas-ambaliya/Desktop/Synapse1/src/execution-engine/paper/index.ts) | useWalletStore/useSettingsStore reads, relative fetch() | Accept wallet/settings as parameters, use dbHandler for double-check |
| [risk/index.ts](file:///home/tejas-ambaliya/Desktop/Synapse1/src/execution-engine/risk/index.ts) | useSettingsStore reads | Accept settings as parameter |
| [daemon.ts](file:///home/tejas-ambaliya/Desktop/Synapse1/src/server/daemon.ts) | Zustand injection, no direct parameter passing | Pass wallet/settings directly to openPosition() and RiskEngine |

---

## Conclusion

The daemon's market data pipeline (WebSocket → Candles → Indicators → Strategies → Signals) works correctly 24/7.

The failure is in the **execution pipeline** (Signal → Position Sizing → Risk Check → Trade Execution), which reads from Zustand UI stores that are empty/default in headless server mode. Every trade attempt is silently rejected due to `balance: 0` or `autoTrading: false`.

The fix requires removing ALL Zustand store reads from the daemon execution path and replacing them with direct database queries or explicit parameter passing.
