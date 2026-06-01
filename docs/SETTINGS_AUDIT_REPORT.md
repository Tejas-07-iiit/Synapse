# Synapse Settings Audit Report

This report presents a complete audit of every setting visible on the Terminal Settings page. The audit traces each setting from the UI, through the database (if applicable), and into the backend execution engines to determine its true functional status.

---

## 1. Theme Appearance
**Settings:** Light Theme, Dark Theme, System Sync
**Status:** ❌ UI ONLY

- **Purpose**: Changes the visual appearance of the application.
- **Database Persistence**: No. Managed entirely by `next-themes` and stored in browser `localStorage`.
- **Runtime Usage**: Only used by UI components to adjust CSS classes and Tailwind properties.
- **Files Involved**: `app/settings/page.tsx`, `providers/theme-provider.tsx`, `components/theme/theme-toggle.tsx`.
- **Affects Trading?**: No.
- **Affects UI?**: Yes. Fully functional visual toggle.

---

## 2. Workspace Defaults
**Settings:** Default Workspace Asset (`prefSymbol`), Default Indicators Timeframe (`prefTimeframe`)
**Status:** 💀 DEAD CODE

- **Purpose**: Intended to set the default coin and timeframe loaded on the dashboard.
- **Database Persistence**: Yes. Stored in `UserSettings` Prisma model and updated via API.
- **Runtime Usage**: None. The `useMarketStore` initializes with hardcoded defaults (`BTCUSDT` and `15m`). `RealtimeProvider` and `DashboardShell` never inject these settings into the engine.
- **Files Involved**: `app/settings/page.tsx`, `src/stores/settingsStore.ts`, `prisma/schema.prisma`.
- **Affects Trading?**: No.
- **Affects UI?**: No. The dashboard ignores these preferences on load.

---

## 3. Risk Management & Default Settings
**Settings:** Target Risk Per Trade (%), Max Open Trades, Default Stop Loss (%), Default Take Profit (%)
**Status:** ✅ FULLY ACTIVE

### Target Risk Per Trade (%)
- **Purpose**: Determines the position size (in USDT) for autonomous trades.
- **Database Persistence**: Yes (`riskPerTradePct`).
- **Runtime Usage**: `PaperTradingEngine.openPosition()` calculates `orderValueUsdt = balance * (settings.riskPerTradePct / 100) * leverage`.
- **Files Involved**: `src/execution-engine/paper/index.ts`.

### Max Open Trades
- **Purpose**: Prevents the system from opening more positions than allowed.
- **Database Persistence**: Yes (`maxOpenTrades`).
- **Runtime Usage**: `RiskEngine.validateOrder()` checks `activePositionsCount >= settings.maxOpenTrades`. The count is evaluated strictly per `userId`.
- **Files Involved**: `src/execution-engine/risk/index.ts`.

### Default Stop Loss (%) & Default Take Profit (%)
- **Purpose**: Fallback SL/TP if the strategy does not provide specific technical levels.
- **Database Persistence**: Yes (`defaultSlPct`, `defaultTpPct`).
- **Runtime Usage**: The `Daemon` calculates `defaultSl` and `defaultTp` based on the entry price and these percentages, then passes them to `openPosition()`. If a strategy provides an SL/TP (like the Lorentzian Strategy's ATR-based levels), the strategy overrides these defaults. If the strategy provides none (like simple crossovers), these defaults are used.
- **Files Involved**: `src/server/daemon.ts`.

---

## 4. Autonomous Paper Trading
**Setting:** Autonomous Paper Trading Toggle (`autoTrading`)
**Status:** ✅ FULLY ACTIVE

- **Purpose**: Enables or disables the actual execution of paper trades.
- **Database Persistence**: Yes (`autoTrading`).
- **Runtime Usage**: 
  1. **Daemon Filter**: The Daemon queries PostgreSQL (`prisma.userSettings.findMany({ where: { autoTrading: true } })`). If a user has this toggled OFF, the daemon completely skips them. It will *not* attempt to open positions for them.
  2. **Risk Engine**: If an execution attempt is made, `RiskEngine.validateOrder()` explicitly checks `isAutoTradingEnabled`.
  3. **Signal Generation**: The `StrategyEngine` generates signals globally regardless of this setting. Turning this OFF stops *execution*, but signals continue to generate and log to the database.
- **Files Involved**: `src/server/daemon.ts`, `src/execution-engine/risk/index.ts`.

---

## 5. Confluence Signal Engines
**Settings:** EMA Ribbon, RSI, MACD, Bollinger, Candlestick AI
**Status:** 💀 DEAD CODE

- **Purpose**: Intended to toggle individual indicator strategies on or off.
- **Database Persistence**: No. Saved only to browser `localStorage` (e.g., `settings_pref_ema`).
- **Runtime Usage**: None. These boolean values are never exported from `app/settings/page.tsx`. The `StrategyEngine` runs all registered strategies blindly.
- **Files Involved**: `app/settings/page.tsx`.
- **Affects Trading?**: No.
- **Affects UI?**: No.

---

## Final Status Table

| Setting | Saved | Loaded | Used in Trading | Used in UI | Status |
|----------|--------|--------|--------|--------|--------|
| Theme (Light/Dark/Sync) | Yes (Local) | Yes | No | Yes | ❌ UI Only |
| Default Workspace Asset | Yes (DB) | Yes | No | No | 💀 Dead Code |
| Default Indicators Timeframe| Yes (DB) | Yes | No | No | 💀 Dead Code |
| Target Risk Per Trade (%) | Yes (DB) | Yes | Yes | Yes | ✅ Fully Functional |
| Max Open Trades | Yes (DB) | Yes | Yes | Yes | ✅ Fully Functional |
| Default Stop Loss (%) | Yes (DB) | Yes | Yes | Yes | ✅ Fully Functional |
| Default Take Profit (%) | Yes (DB) | Yes | Yes | Yes | ✅ Fully Functional |
| Autonomous Paper Trading | Yes (DB) | Yes | Yes | Yes | ✅ Fully Functional |
| Confluence: EMA Ribbon | Yes (Local) | Yes | No | No | 💀 Dead Code |
| Confluence: RSI | Yes (Local) | Yes | No | No | 💀 Dead Code |
| Confluence: MACD | Yes (Local) | Yes | No | No | 💀 Dead Code |
| Confluence: Bollinger | Yes (Local) | Yes | No | No | 💀 Dead Code |
| Confluence: Candlestick AI| Yes (Local) | Yes | No | No | 💀 Dead Code |

### Status Legend
- ✅ **Fully Functional**: Validated end-to-end (UI → DB → Execution Engine).
- ❌ **UI Only**: Functions correctly but only affects visual elements.
- 💀 **Dead Code**: Saved in UI or DB but ignored completely by the core engines.