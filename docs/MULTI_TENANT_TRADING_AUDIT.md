# CRITICAL MULTI-TENANT TRADING AUDIT REPORT

## 1. Executive Summary & Root Cause Analysis

The core reason two different user accounts are receiving **identical trades** (same entry, stop loss, and take profit, differing only by position size) is due to a fundamental architectural flaw in the trading backend. 

Currently, the system is designed as a **Centralized Strategy Broadcaster** rather than a **Per-User Execution Engine**. 
1. The `StrategyEngine` (in `src/server/daemon.ts`) acts as a global singleton. It evaluates the market once per tick and generates a single set of trade signals.
2. The daemon calculates a universal Stop Loss (SL) and Take Profit (TP) globally based on ATR indicators, **completely ignoring** user-specific preferences (`defaultSlPct`, `defaultTpPct` from `UserSettings`).
3. It then loops over all users with `autoTrading: true` (`for (const settings of usersWithAuto)`) and executes the exact same global trade parameters for every subscribed user.
4. Position size is calculated correctly per-user based on their individual wallet balance and risk percentage, which is why only the fees and position size differ.

## 2. Files Involved & Exact Code Locations

### A. Trade Generation Flow (Global Broadcasting)
- **File**: `src/server/daemon.ts`
- **Location**: Line 374 `for (const settings of usersWithAuto)`
- **Issue**: The `StrategyEngine` registers a global callback. When a signal is triggered, it loops through all users and applies the exact same trade variables (`finalSl`, `finalTp`, `sig.entry`) to everyone, bypassing individual user settings.

### B. Execution Engine Concurrency Bug
- **File**: `src/execution-engine/paper/index.ts`
- **Location**: Line 210 (`this.executionLocks.has(sym)`)
- **Issue**: The execution lock is keyed by `symbol` (e.g., "BTCUSDT") without incorporating the `userId`. Because it locks on the symbol, and is synchronously released at the end of the `try...finally` block, the daemon successfully acquires, executes, and releases the lock sequentially for each user in the `usersWithAuto` loop. This confirms that all users receive the trade synchronously, leading to identical execution timestamps.

### C. Database Layer & API Routes (Critical Data Leakage)
- **Files**: `app/api/positions/route.ts`, `app/api/trade-history/route.ts`, `app/api/settings/route.ts`
- **Location**: e.g., `const userId = searchParams.get("userId")`
- **Issue**: **Critical Security Vulnerability**. The API routes extract `userId` directly from the query parameter without validating it against the server-side JWT session. Any user (or external actor) can query `?userId=another-users-uuid` and instantly access their open positions, full trade history, and account settings.
- **Middleware**: `middleware.ts` explicitly omits `/api/:path*` from its `matcher` and protection checks.

## 3. Security & Multi-Tenant Isolation Issues

1. **Broken Access Control (IDOR)**: The API layer has zero enforcement of session identity. All data is exposed via Insecure Direct Object Reference (IDOR).
2. **Strategy Data Contamination**: If the system is intended to be a multi-tenant platform where users deploy their own strategies or customize risk parameters, the global loop approach entirely breaks isolation.
3. **Execution Bottleneck**: Executing trades sequentially inside `for (const settings of usersWithAuto)` is non-scalable. If there are 1,000 users, the 1,000th user will receive immense slippage as they wait for 999 database writes to finish.

## 4. Recommended Fixes

### Fix 1: Secure API Routes & Middleware
Update `middleware.ts` to include API routes in its matcher, or implement a rigorous server-side session check inside every API route.
```typescript
// Example fix inside API routes
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";

const token = cookies().get("token")?.value;
const session = verifyToken(token);
if (!session || session.id !== requestUserId) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

### Fix 2: Move SL/TP Calculation to Per-User Scope
In `src/server/daemon.ts`, move the Stop Loss and Take Profit calculations **inside** the `usersWithAuto` loop. Modify the logic to respect the user's `defaultSlPct` and `defaultTpPct` settings rather than overriding them globally with ATR.

### Fix 3: Fix Mutex Locks
Update the `executionLocks` in `PaperTradingEngine` to include `userId` to prevent symbol locking across different users:
```typescript
const lockKey = `${userId}_${sym}`;
if (this.executionLocks.has(lockKey)) return null;
this.executionLocks.add(lockKey);
```

### Fix 4: Decouple Execution (Asynchronous Processing)
Instead of sequentially awaiting `PaperTradingEngine.openPosition` inside the daemon loop, map the executions to an asynchronous promise array or push them to a Redis/RabbitMQ queue. This will prevent execution lag and ensure users get filled as close to the signal timestamp as possible.

## 5. Actions Taken
I have already injected temporary debug logs into `src/server/daemon.ts` to log `[MULTI-TENANT DEBUG] TRADE GENERATED -> userId: ..., strategyId: ..., positionId: ...` so we can explicitly track execution independence moving forward.