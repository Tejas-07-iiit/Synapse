# Synapse Trading Runtime Architecture Audit

This report presents a complete runtime architecture audit of the Synapse trading system. The goal of this audit is to determine whether the trading engine runs continuously on the server (24/7) or if it only starts when a user opens the dashboard in a web browser. We trace the execution paths, analyze runtime dependencies, perform a risk assessment, and provide a final verdict on the system's readiness for production 24/7 headless operations.

---

## 1. Core Engine Initialization & Discovery

To map the engine execution tree, the codebase was audited for key classes, initialization functions, and connection hooks. Below are the precise locations of the key components:

### 1. MarketEngine Initialization
* **Location**: [market-engine.ts](file:///home/tejas-ambaliya/Desktop/Synapse1/src/market-engine/market-engine.ts#L478)
* **Code Reference**:
  ```typescript
  export const marketEngine = new MarketEngine();
  ```
  The `MarketEngine` is instantiated as a singleton exported by `market-engine.ts`. It is initialized via `marketEngine.init(symbol, timeframe)` (defined at [market-engine.ts:L54](file:///home/tejas-ambaliya/Desktop/Synapse1/src/market-engine/market-engine.ts#L54)), which loads active positions, pulls historical backfill candles, and connects to WebSocket feeds.

### 2. StrategyEngine Initialization
* **Location**: [engine.ts](file:///home/tejas-ambaliya/Desktop/Synapse1/src/strategy-engine/core/engine.ts#L258)
* **Code Reference**:
  ```typescript
  export const strategyEngine = new StrategyEngine();
  ```
  The `StrategyEngine` is instantiated as a singleton exported by `src/strategy-engine/core/engine.ts`. Its setup is triggered when `MarketEngine` is constructed, invoking `initializeStrategies()` in its constructor (defined at [market-engine.ts:L24](file:///home/tejas-ambaliya/Desktop/Synapse1/src/market-engine/market-engine.ts#L24)).

### 3. PaperTradingEngine Initialization
* **Location**: [index.ts](file:///home/tejas-ambaliya/Desktop/Synapse1/src/execution-engine/paper/index.ts#L14)
* **Code Reference**:
  ```typescript
  export class PaperTradingEngine {
  ```
  `PaperTradingEngine` is a static helper class. It does not require instantiation (`new PaperTradingEngine`). It maintains static in-memory caches for open positions (`positions`) and is initialized by loading positions from the database via `PaperTradingEngine.loadActivePositions(userId)` (defined at [index.ts:L28](file:///home/tejas-ambaliya/Desktop/Synapse1/src/execution-engine/paper/index.ts#L28)).

### 4. WebSocket Connections Start
* **Location**: [index.ts](file:///home/tejas-ambaliya/Desktop/Synapse1/src/market-engine/websocket/index.ts#L63)
* **Code Reference**:
  ```typescript
  public connect() {
    const WS = this.getWSConstructor();
    ...
    this.socket = new WS("wss://stream.binance.com:9443/ws");
  ```
  WebSocket connections to Binance are established via `marketWsService.connect()`. In browser-dependent mode, this is triggered when the root [realtime-provider.tsx](file:///home/tejas-ambaliya/Desktop/Synapse1/providers/realtime-provider.tsx#L56) component mounts. In headless server-side mode, it is started by [daemon.ts](file:///home/tejas-ambaliya/Desktop/Synapse1/src/server/daemon.ts#L356).

### 5. Autonomous Trading Start
* **Location**: [market-engine.ts](file:///home/tejas-ambaliya/Desktop/Synapse1/src/market-engine/market-engine.ts#L371-L420)
* **Code Reference**:
  ```typescript
  const isAutonomous = settings.autoTrading || 
    process.env.NEXT_PUBLIC_AUTONOMOUS_TRADING === "true" || 
    process.env.NEXT_PUBLIC_AUTONOMOUS_TRADING === "on";
  ...
  const position = await PaperTradingEngine.openPosition(...);
  ```
  Autonomous trading starts in `MarketEngine.recalculate()` when a candle closes. If auto-trading is enabled in user settings or environment variables, it calls `PaperTradingEngine.openPosition()`.

### 6. Signal Generation Start
* **Location**: [engine.ts](file:///home/tejas-ambaliya/Desktop/Synapse1/src/strategy-engine/core/engine.ts#L155-L177)
* **Code Reference**:
  ```typescript
  const prioritizedSignals = SignalPriorityEngine.prioritize(rawSignals);
  ...
  return { signals: prioritizedSignals, indicators };
  ```
  Signals are generated inside `StrategyEngine.processTick()` after running all active strategies. The raw signals are filtered and prioritized by `SignalPriorityEngine` before being returned to the market engine.

### 7. Strategy Evaluation Start
* **Location**: [engine.ts](file:///home/tejas-ambaliya/Desktop/Synapse1/src/strategy-engine/core/engine.ts#L122-L153)
* **Code Reference**:
  ```typescript
  for (const strategy of activeStrategies) {
    ...
    const { signal, latencyMs } = StrategyRunner.run(strategy, context);
  ```
  Strategy evaluation begins inside `StrategyEngine.processTick()`. It loops through the registry of active strategies, checks if they match the current symbol and timeframe, and executes them via `StrategyRunner.run()`.

---

## 2. Startup Flow

The system operates in one of two flows depending on how it is deployed: the **Default Client-Side Flow** and the **PM2 Server-Side Daemon Flow**.

### A. Default Client-Side Flow (Browser-Dependent)
This sequence runs if the Next.js server is started normally and a user opens the web application. The engine runs inside the user's browser:

```
Server Start (Next.js hosting API routes)
↓
Browser Opens Website
↓
Root layout.tsx renders RealtimeProvider
↓
RealtimeProvider mounts & calls marketEngine.init()
↓
MarketEngine constructor runs initializeStrategies() (Strategy Engine Setup)
↓
MarketEngine.init() calls PaperTradingEngine.loadActivePositions()
↓
WebSocket Connection Starts (marketWsService.connect() -> Binance Stream)
↓
WebSocket receives Kline (Candle Close) Update
↓
MarketEngine.onCandleClose() calls recalculate()
↓
recalculate() calls strategyEngine.processTick() (Strategy Evaluation & Indicators)
↓
strategyEngine generates and filters signals (Signal Generation)
↓
recalculate() catches signals & checks autoTrading settings
↓
PaperTradingEngine.openPosition() is triggered (Execution Engine)
```

### B. PM2 Server-Side Daemon Flow (Headless Autonomous)
This sequence runs if the background daemon is started on the server using PM2 (`pm2 start ecosystem.config.js`):

```
Server Start (Next.js server + PM2 launches src/server/daemon.ts)
↓
Daemon registers direct Prisma DB handlers for PaperTradingEngine & StrategyEngine
↓
Daemon calls PaperTradingEngine.loadActivePositions() for all users
↓
Daemon calls marketEngine.init("BTCUSDT", "15m")
↓
MarketEngine constructor runs initializeStrategies() (Strategy Engine Setup)
↓
Daemon subscribes to @ticker and @kline WebSocket streams
↓
WebSocket Connection Starts (marketWsService.connect() -> Binance Stream on Server)
↓
Real-time Tickers stream into PaperTradingEngine.updatePrices() (SL/TP Monitors)
↓
Kline closes stream into MarketEngine.onCandleClose() -> recalculate()
↓
recalculate() calls strategyEngine.processTick() (Strategy Evaluation & Indicators)
↓
Signals are evaluated and executed via PaperTradingEngine directly writing to PostgreSQL
```

---

## 3. Runtime Dependency Analysis

Below are the answers to the operational dependency questions:

* **Does MarketEngine start when server starts?**
  * **Without Daemon**: **No**. The Next.js server only hosts APIs and builds pages. `MarketEngine` is client-side code and remains dormant until a client browser mounts it.
  * **With Daemon**: **Yes**. When PM2 starts `src/server/daemon.ts`, it instantiates and initializes `MarketEngine` on server boot, running it headlessly in a Node.js process.
* **Does MarketEngine start when dashboard opens?**
  * **Yes**. Opening the dashboard (or any page wrapped by `RealtimeProvider` in [layout.tsx](file:///home/tejas-ambaliya/Desktop/Synapse1/app/layout.tsx)) triggers `marketEngine.init()`.
* **Does MarketEngine start when a websocket client connects?**
  * **No**. The browser client connects *to* Binance's websocket feed *after* `MarketEngine` is initialized. There is no server-side WebSocket server waiting for connections to trigger the engine.
* **Does strategy evaluation depend on browser activity?**
  * **Without Daemon**: **Yes**. Ticks are received via the browser's WebSocket connection. If no browser is active, no ticks arrive, and no strategies are evaluated.
  * **With Daemon**: **No**. The daemon runs its own persistent Node.js WebSocket client to receive ticks and run strategy evaluations on the server 24/7.
* **Does autonomous trading depend on browser activity?**
  * **Without Daemon**: **Yes**. Open positions are monitored for SL/TP exits, and strategies are evaluated for entries, entirely within the client's browser execution loop.
  * **With Daemon**: **No**. The daemon performs all evaluations and executes trades directly in PostgreSQL, completely independent of the browser.

---

## 4. Browser Independence Test

We evaluated the behavior of core trading system functions under various user states:

| Scenario | Prices Updating? | Strategies Running? | Signals Generating? | Trades Executing? | Technical Explanation |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **A. Standard Deploy (No Daemon)** | | | | | |
| *Browser Closed* | ❌ No | ❌ No | ❌ No | ❌ No | Client WebSocket drops; Next.js has no active server thread running the engines. |
| *User Logs Out* | ⚠️ Partial | ⚠️ Partial | ⚠️ Partial | ❌ No | If browser remains open on the login page, `RealtimeProvider` continues running using `default-user-id`, but user-specific trades and settings are disabled. |
| *No Users Online* | ❌ No | ❌ No | ❌ No | ❌ No | Zero active browsers means zero execution loops are running anywhere. |
| *Dashboard Never Opened* | ❌ No | ❌ No | ❌ No | ❌ No | The entry hook `RealtimeProvider` is never mounted, leaving the system completely dormant. |
| **B. Daemon Deploy (PM2 Running)** | | | | | |
| *Browser Closed* |  Yes |  Yes |  Yes |  Yes | PM2 maintains `daemon.ts` which runs a headless Node.js process with a persistent WebSocket connection. |
| *User Logs Out* |  Yes |  Yes |  Yes |  Yes | The daemon queries DB configurations directly (`UserSettings` and `Wallet`) instead of relying on front-end Zustand stores. |
| *No Users Online* |  Yes |  Yes |  Yes |  Yes | The daemon operates autonomously, monitoring active positions for all registered users in PostgreSQL. |
| *Dashboard Never Opened* |  Yes |  Yes |  Yes |  Yes | The daemon initializes and subscribes to streams on startup, regardless of dashboard visits. |

---

## 5. PM2 Analysis

> [!IMPORTANT]
> **Is PM2 alone sufficient to keep the system running?**
> 
> * **No**, if you only run the standard Next.js application (`pm2 start npm -- run start`). Next.js is a request-response framework; starting it with PM2 does not instantiate the WebSocket client or run background execution loops on the server.
> * **Yes**, if you run the Next.js app alongside the background daemon script (`pm2 start ecosystem.config.js`). PM2 manages [daemon.ts](file:///home/tejas-ambaliya/Desktop/Synapse1/src/server/daemon.ts) as a continuous background daemon, ensuring it reconnects to WebSockets and auto-restarts on crashes.

---

## 6. Risk Assessment

We classify the architecture under two conditions:

### Scenario 1: Standard Next.js Web Deployment
* **Classification**: **C. Fully Browser Dependent**
* **Evidence**:
  * The primary initialization hook is inside a React Context provider ([realtime-provider.tsx:L91](file:///home/tejas-ambaliya/Desktop/Synapse1/providers/realtime-provider.tsx#L91)).
  * In-memory caches and execution states depend on React Zustand stores (`useMarketStore`, `useWalletStore`, `useAuthStore`) which run in client memory.
  * Trade executions and price updates make HTTP `fetch()` requests back to server API routes `/api/positions` ([index.ts:L34](file:///home/tejas-ambaliya/Desktop/Synapse1/src/execution-engine/paper/index.ts#L34), [index.ts:L106](file:///home/tejas-ambaliya/Desktop/Synapse1/src/execution-engine/paper/index.ts#L106)), which can fail due to network drops, authentication timeouts, or browser freezes.

### Scenario 2: PM2 Daemon Deployment (Running `src/server/daemon.ts`)
* **Classification**: **A. Fully Autonomous 24/7**
* **Evidence**:
  * The daemon bypasses React layout dependencies and registers a direct `PrismaClient` database handler for the `PaperTradingEngine` and `StrategyEngine` ([daemon.ts:L18-L244](file:///home/tejas-ambaliya/Desktop/Synapse1/src/server/daemon.ts#L18-L244)).
  * Instead of HTTP requests, the engines perform database queries directly, eliminating network-induced execution failures.
  * The daemon intercepts generated strategy signals, queries user settings from PostgreSQL, injects them into Zustand mock-states, and runs risk validation headlessly on the server.

---

## 7. Final Verdict

### Dual Verdict

* **Standard Deployment (Next.js only)**: **NOT SAFE FOR 24/7 TRADING**
* **Daemon Deployment (PM2 + `daemon.ts`)**: **SAFE FOR 24/7 TRADING**

> [!CAUTION]
> If you deploy only the Next.js server on an EC2 instance without running the server daemon, the system is **NOT SAFE FOR 24/7 TRADING**.
> Closing your browser tab will terminate the price monitor and the strategy runner. Open positions will be left completely unmanaged, meaning Stop Loss (SL) and Take Profit (TP) orders will never execute. This presents a catastrophic risk of liquidation or unlimited loss.
> 
> To run safely 24/7, you **MUST** run the system via PM2 using the background daemon configuration.

### Deployment Instructions for 24/7 Autonomous Execution
To ensure the trading engine runs headlessly and continuously on your EC2 instance, execute the following commands in the workspace root:

1. **Build the Application**:
   ```bash
   npm run build
   ```
2. **Start PM2 with the Ecosystem Configuration**:
   ```bash
   pm2 start ecosystem.config.js
   ```
3. **Persist the PM2 Process List**:
   ```bash
   pm2 save
   ```
4. **Enable PM2 to Start on Server Boot**:
   ```bash
   pm2 startup
   ```
   *(Follow the on-screen instructions to run the generated sudo command)*

This setup will run the Next.js UI dashboard under `synapse-next-app` (accessible to users) and the headless engine daemon under `synapse-trading-daemon` (handling 24/7 trade execution, strategy evaluation, and SL/TP checking in the background).
