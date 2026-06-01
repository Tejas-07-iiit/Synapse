import { VirtualPosition, VirtualOrder } from "../types";
import { RiskEngine, RiskCheckSettings } from "../risk";
import { useWalletStore } from "@/src/stores/walletStore";
import { useSettingsStore } from "@/src/stores/settingsStore";

export interface PaperTradingSettings {
  autoTrading: boolean;
  maxOpenTrades: number;
  riskPerTradePct: number;
}

export interface DbClientHandler {
  fetchActivePositions: (userId: string) => Promise<any[]>;
  openPosition: (data: any) => Promise<any>;
  updatePosition: (id: string, currentPrice: number, pnl: number) => Promise<any>;
  closePosition: (data: any) => Promise<any>;
  fetchWallet: (userId: string) => Promise<any>;
}

export class PaperTradingEngine {
  private static dbHandler: DbClientHandler | null = null;

  public static registerDbHandler(handler: DbClientHandler) {
    this.dbHandler = handler;
  }
  private static positions: Map<string, VirtualPosition> = new Map(); // positionId -> Position
  private static lastDbUpdate: Map<string, number> = new Map(); // positionId -> timestamp
  private static executionLocks: Set<string> = new Set(); // Mutex for concurrent symbol processing
  private static symbolCooldowns: Map<string, number> = new Map(); // symbol -> cooldown expiry timestamp

  /**
   * Initializes virtual positions by loading any open ones from the database on startup.
   */
  public static async loadActivePositions(userId: string) {
    try {
      let positionsList: any[] = [];
      if (this.dbHandler) {
        positionsList = await this.dbHandler.fetchActivePositions(userId);
      } else {
        const res = await fetch(`/api/positions?userId=${encodeURIComponent(userId)}`);
        const body = await res.json();
        if (body.success && Array.isArray(body.positions)) {
          positionsList = body.positions;
        }
      }
      
      // Clear only this user's positions from memory cache to avoid conflicts in multi-user daemon mode
      for (const [id, pos] of this.positions.entries()) {
        if (pos.userId === userId) {
          this.positions.delete(id);
        }
      }
      for (const pos of positionsList) {
        this.positions.set(pos.id, {
          id: pos.id,
          userId: pos.userId,
          symbol: pos.symbol,
          direction: pos.direction as "LONG" | "SHORT",
          entryPrice: pos.entryPrice,
          currentPrice: pos.currentPrice,
          quantity: pos.quantity,
          stopLoss: pos.stopLoss,
          takeProfit: pos.takeProfit,
          leverage: pos.leverage,
          pnl: pos.pnl,
          status: "OPEN",
          openedAt: new Date(pos.openedAt).getTime(),
          closedAt: null,
          strategyId: pos.strategyId || undefined,
          strategyName: pos.strategyName || undefined,
          strategyCategory: pos.strategyCategory || undefined,
          entryReason: pos.entryReason || undefined,
          confidenceAtEntry: pos.confidenceAtEntry || undefined,
          marketRegime: pos.marketRegime || undefined,
          indicatorSnapshot: pos.indicatorSnapshot || undefined,
        });
      }
      console.log(`[PaperTrading] Loaded ${positionsList.length} active positions from database.`);
    } catch (e) {
      console.error("[PaperTrading] Failed to load open positions from DB:", e);
    }
  }

  public static getOpenPositions(): VirtualPosition[] {
    return Array.from(this.positions.values()).filter((p) => p.status === "OPEN");
  }

  /**
   * Evaluates incoming real-time price updates against open positions.
   * Checks stopLoss and takeProfit conditions to trigger auto-liquidations/exits.
   */
  public static async updatePrices(symbol: string, currentPrice: number) {
    const sym = symbol.toUpperCase();
    const activePositions = Array.from(this.positions.values()).filter(
      (p) => p.symbol === sym && p.status === "OPEN"
    );

    for (const pos of activePositions) {
      pos.currentPrice = currentPrice;

      // Calculate floating PnL
      const entryVal = pos.entryPrice * pos.quantity;
      const currentVal = currentPrice * pos.quantity;
      if (pos.direction === "LONG") {
        pos.pnl = (currentVal - entryVal) * pos.leverage;
      } else {
        pos.pnl = (entryVal - currentVal) * pos.leverage;
      }

      // Update in DB (non-blocking) via API, throttled to once every 10 seconds
      const now = Date.now();
      const lastUpdate = this.lastDbUpdate.get(pos.id) || 0;
      if (now - lastUpdate > 10000) {
        this.lastDbUpdate.set(pos.id, now);
        console.log(`[SLTP_MONITOR] Symbol: ${sym} | Price: $${currentPrice.toFixed(2)} | Pos ID: ${pos.id} | Entry: $${pos.entryPrice.toFixed(2)} | SL: ${pos.stopLoss ? pos.stopLoss.toFixed(2) : "None"} | TP: ${pos.takeProfit ? pos.takeProfit.toFixed(2) : "None"} | Current PnL: $${pos.pnl.toFixed(2)}`);
        if (this.dbHandler) {
          this.dbHandler.updatePosition(pos.id, currentPrice, pos.pnl).catch(() => {});
        } else {
          fetch("/api/positions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "update",
              data: { id: pos.id, currentPrice, pnl: pos.pnl },
            }),
          }).catch(() => {});
        }
      }

      // Check Stop Loss & Take Profit exits
      let shouldClose = false;
      let exitReason = "";

      if (pos.direction === "LONG") {
        if (pos.stopLoss && currentPrice <= pos.stopLoss) {
          shouldClose = true;
          exitReason = "STOP_LOSS";
        } else if (pos.takeProfit && currentPrice >= pos.takeProfit) {
          shouldClose = true;
          exitReason = "TAKE_PROFIT";
        }
      } else {
        if (pos.stopLoss && currentPrice >= pos.stopLoss) {
          shouldClose = true;
          exitReason = "STOP_LOSS";
        } else if (pos.takeProfit && currentPrice <= pos.takeProfit) {
          shouldClose = true;
          exitReason = "TAKE_PROFIT";
        }
      }

      if (shouldClose) {
        await this.closePosition(pos.id, currentPrice, exitReason);
      }
    }
  }

  /**
   * Opens a new paper trading position.
   * Saves to PostgreSQL via the /api/positions API endpoint.
   */
  public static async openPosition(
    userId: string,
    symbol: string,
    direction: "LONG" | "SHORT",
    price: number,
    sizeUsdt: number | null = null,
    stopLoss: number | null = null,
    takeProfit: number | null = null,
    leverage: number = 1,
    explicitBalance?: number,
    explicitSettings?: PaperTradingSettings,
    signalContext?: any
  ): Promise<VirtualPosition | null> {
    const sym = symbol.toUpperCase();

    // 1. ACQUIRE MUTEX LOCK
    if (this.executionLocks.has(sym)) {
      console.log(`[MUTEX_LOCK] Execution already in progress for ${sym}. Rejecting concurrent attempt.`);
      return null;
    }
    this.executionLocks.add(sym);

    try {
      console.log(`[PAPER_TRADING] Attempting to open position: ${direction} ${sym} @ $${price}`);

      const strategyId = signalContext?.strategyId || "manual";
      const strategyName = signalContext?.strategyName || "Manual Trade";
      const strategyCategory = signalContext?.strategyCategory || "Manual";
      const entryReason = signalContext?.reasoning ? signalContext.reasoning.join(". ") : "Manual execution by user.";
      const confidenceAtEntry = signalContext?.confidence !== undefined ? signalContext.confidence / 100 : 1.0;
      const marketRegime = signalContext?.marketContext?.regime || "UNKNOWN";
      const indicatorSnapshot = signalContext?.indicators || {};

      // 1.5 CHECK COOLDOWN
      const cooldownExpiry = this.symbolCooldowns.get(sym) || 0;
      if (Date.now() < cooldownExpiry) {
        const remainingSeconds = Math.ceil((cooldownExpiry - Date.now()) / 1000);
        console.log(`[COOLDOWN_ACTIVE] ${sym} is in cooldown. Execution blocked. Remaining: ${remainingSeconds}s.`);
        return null;
      }

      // Check if position already exists for symbol in memory
      let alreadyOpen = Array.from(this.positions.values()).some(
        (p) => p.symbol === sym && p.status === "OPEN" && p.userId === userId
      );

      if (alreadyOpen) {
        console.log(`[POSITION_LOCK] ${sym} blocked → existing active trade found`);
        console.log(`[TRADE_REJECTED] Reason: Active position already exists for ${sym}`);
        return null;
      }

      // Double-check database to be absolutely sure
      try {
        let dbOpen = false;
        if (this.dbHandler) {
          const dbPositions = await this.dbHandler.fetchActivePositions(userId);
          dbOpen = dbPositions.some(
            (p: { symbol: string; status: string }) => p.symbol === sym && p.status === "OPEN"
          );
        } else if (typeof window !== "undefined") {
          const res = await fetch(`/api/positions?userId=${encodeURIComponent(userId)}`);
          const body = await res.json();
          if (body.success && Array.isArray(body.positions)) {
            dbOpen = body.positions.some(
              (p: { symbol: string; status: string }) => p.symbol === sym && p.status === "OPEN"
            );
          }
        }
        if (dbOpen) {
          alreadyOpen = true;
          console.log(`[POSITION_LOCK] ${sym} blocked → existing active trade found`);
          console.log(`[TRADE_REJECTED] Reason: Active position already exists for ${sym}`);
          return null;
        }
      } catch (e) {
        console.warn("[PaperTradingEngine] Database position lock check failed, proceeding with in-memory state:", e);
      }

      console.log(`[TRADE_ALLOWED] No active position found for ${sym}`);

      let qty = 0;
      let orderValueUsdt = 0;

      let balance = explicitBalance !== undefined ? explicitBalance : 0;
      if (explicitBalance === undefined) {
        balance = useWalletStore.getState().balance;
      }
      
      const settings = explicitSettings || useSettingsStore.getState();

      if (sizeUsdt === null) {
        orderValueUsdt = balance * (settings.riskPerTradePct / 100) * leverage;
      } else {
        orderValueUsdt = sizeUsdt;
      }
      
      console.log(`[POSITION_SIZING] Wallet balance: $${balance.toFixed(2)} | Risk per trade: ${settings.riskPerTradePct}% | Leverage: ${leverage}x | Calculated order size: $${orderValueUsdt.toFixed(2)}`);

      if (orderValueUsdt <= 0 || isNaN(orderValueUsdt)) {
        console.log(`[POSITION_REJECTED] Invalid position size calculated: $${orderValueUsdt.toFixed(2)}. Aborting.`);
        return null;
      }

      qty = orderValueUsdt / price;

      if (qty <= 0 || isNaN(qty)) {
        console.log(`[POSITION_REJECTED] Invalid quantity calculated: ${qty}. Aborting.`);
        return null;
      }
      
      // Calculate available balance (Balance - Margin Used)
      const usedMargin = Array.from(this.positions.values())
        .filter(p => p.status === "OPEN" && p.userId === userId)
        .reduce((sum, p) => sum + (p.entryPrice * p.quantity) / p.leverage, 0);

      const availableBalance = balance - usedMargin;

      // Validate order against risk manager
      const dummyOrder: VirtualOrder = {
        id: "risk-check",
        symbol: sym,
        direction,
        type: "MARKET",
        price,
        quantity: qty,
        timestamp: Date.now(),
        status: "PENDING",
      };

      const userActivePositionsCount = this.getOpenPositions().filter(p => p.userId === userId).length;

      const riskResult = RiskEngine.validateOrder(
        dummyOrder, 
        userActivePositionsCount, 
        alreadyOpen,
        leverage,
        availableBalance,
        explicitSettings
      );
      if (!riskResult.allowed) {
        return null;
      }

      try {
        console.log(`[DB_WRITE] Dispatching position open transaction to database for ${sym}`);
        let dbPos: any = null;
        if (this.dbHandler) {
          dbPos = await this.dbHandler.openPosition({
            userId,
            symbol: sym,
            direction,
            entryPrice: price,
            quantity: qty,
            stopLoss,
            takeProfit,
            leverage,
            strategyId,
            strategyName,
            strategyCategory,
            entryReason,
            confidenceAtEntry,
            marketRegime,
            indicatorSnapshot,
          });
        } else {
          // Save position to DB via API
          const res = await fetch("/api/positions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({  
              action: "open",
              data: {
                userId,
                symbol: sym,
                direction,
                entryPrice: price,
                quantity: qty,
                stopLoss,
                takeProfit,
                leverage,
                strategyId,
                strategyName,
                strategyCategory,
                entryReason,
                confidenceAtEntry,
                marketRegime,
                indicatorSnapshot,
              },
            }),
          });

          const body = await res.json();
          if (!body.success) {
            throw new Error(body.error || "Failed to open position");
          }
          dbPos = body.position;
        }

        console.log(`[TRADE_CREATED] Trade successfully saved in DB. Position ID: ${dbPos.id}`);

        const position: VirtualPosition = {
          id: dbPos.id,
          userId: dbPos.userId,
          symbol: dbPos.symbol,
          direction: dbPos.direction as "LONG" | "SHORT",
          entryPrice: dbPos.entryPrice,
          currentPrice: dbPos.currentPrice,
          quantity: dbPos.quantity,
          stopLoss: dbPos.stopLoss,
          takeProfit: dbPos.takeProfit,
          leverage: dbPos.leverage,
          pnl: dbPos.pnl,
          status: "OPEN",
          openedAt: new Date(dbPos.openedAt).getTime(),
          closedAt: null,
          strategyId: dbPos.strategyId || undefined,
          strategyName: dbPos.strategyName || undefined,
          strategyCategory: dbPos.strategyCategory || undefined,
          entryReason: dbPos.entryReason || undefined,
          confidenceAtEntry: dbPos.confidenceAtEntry || undefined,
          marketRegime: dbPos.marketRegime || undefined,
          indicatorSnapshot: dbPos.indicatorSnapshot || undefined,
        };

        this.positions.set(position.id, position);
        console.log(`[POSITION_OPENED] ✅ Opened position: ${direction} ${sym} at $${price} | Qty: ${qty.toFixed(6)} | SL: ${stopLoss} | TP: ${takeProfit}`);
        
        // Update store balance to keep in sync
        if (typeof window !== "undefined") {
          useWalletStore.getState().fetchWallet(userId).catch(() => {});
        }

        return position;
      } catch (err) {
        console.log(`[POSITION_REJECTED] Database write failed: ${err}`);
        console.error("[PaperTrading] Failed to open position in DB:", err);
        return null;
      }
    } finally {
      // 2. ALWAYS RELEASE MUTEX LOCK
      this.executionLocks.delete(sym);
    }
  }

  /**
   * Closes an existing position and logs it to TradeHistory.
   * Records the trade via the /api/positions API endpoint.
   */
  public static async closePosition(
    positionId: string,
    exitPrice: number,
    reason: string = "MANUAL"
  ): Promise<boolean> {
    const pos = this.positions.get(positionId);
    if (!pos || pos.status === "CLOSED") return false;

    // SYNCHRONOUSLY MARK AS CLOSED TO PREVENT WEBSOCKET TICK RACE CONDITIONS
    pos.status = "CLOSED";

    console.log(`[PAPER_TRADING] Closing position ${positionId} for ${pos.symbol} at exit price $${exitPrice} (Reason: ${reason})`);

    const closedAt = Date.now();
    pos.closedAt = closedAt;
    pos.currentPrice = exitPrice;

    // Calculate final PnL
    const entryVal = pos.entryPrice * pos.quantity;
    const exitVal = exitPrice * pos.quantity;
    if (pos.direction === "LONG") {
      pos.pnl = exitVal - entryVal;
    } else {
      pos.pnl = entryVal - exitVal;
    }

    const exitReasonExplanation = reason === "STOP_LOSS" || reason === "STOPPED" || reason === "SL HIT"
      ? `Stop Loss triggered after price moved against position by ${pos.entryPrice > 0 ? (Math.abs(exitPrice - pos.entryPrice) / pos.entryPrice * 100).toFixed(1) : 0}%.`
      : reason === "TAKE_PROFIT" || reason === "TP HIT"
      ? `Take Profit reached at $${exitPrice.toFixed(2)}.`
      : reason === "OPPOSITE_SIGNAL"
      ? `Position closed due to opposite signal generated by ${pos.strategyName || "strategy"}.`
      : reason === "TIMEOUT"
      ? `Position closed due to timeout rule.`
      : reason === "RISK"
      ? `Position closed by Risk Engine guard.`
      : "Position closed manually by user.";

    try {
      console.log(`[DB_WRITE] Dispatching position close transaction to database for ID: ${positionId}`);
      if (this.dbHandler) {
        await this.dbHandler.closePosition({
          id: positionId,
          exitPrice,
          pnl: pos.pnl,
          closedAt,
          openedAt: pos.openedAt,
          userId: pos.userId,
          symbol: pos.symbol,
          direction: pos.direction,
          entryPrice: pos.entryPrice,
          quantity: pos.quantity,
          stopLoss: pos.stopLoss,
          takeProfit: pos.takeProfit,
          leverage: pos.leverage,
          reason,
          strategyId: pos.strategyId,
          strategyName: pos.strategyName,
          strategyCategory: pos.strategyCategory,
          entryReason: pos.entryReason,
          confidenceAtEntry: pos.confidenceAtEntry,
          marketRegime: pos.marketRegime,
          indicatorSnapshot: pos.indicatorSnapshot,
          exitReason: exitReasonExplanation,
        });
      } else {
        // Close position in DB via API
        const res = await fetch("/api/positions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "close",
            data: {
              id: positionId,
              exitPrice,
              pnl: pos.pnl,
              closedAt,
              openedAt: pos.openedAt,
              userId: pos.userId,
              symbol: pos.symbol,
              direction: pos.direction,
              entryPrice: pos.entryPrice,
              quantity: pos.quantity,
              stopLoss: pos.stopLoss,
              takeProfit: pos.takeProfit,
              leverage: pos.leverage,
              reason,
              strategyId: pos.strategyId,
              strategyName: pos.strategyName,
              strategyCategory: pos.strategyCategory,
              entryReason: pos.entryReason,
              confidenceAtEntry: pos.confidenceAtEntry,
              marketRegime: pos.marketRegime,
              indicatorSnapshot: pos.indicatorSnapshot,
              exitReason: exitReasonExplanation,
            },
          }),
        });

        const body = await res.json();
        if (!body.success) {
          throw new Error(body.error || "Failed to close position");
        }
      }

      this.positions.delete(positionId);
      console.log(`[POSITION_CLOSED] ✅ Closed position: ${pos.direction} ${pos.symbol} at $${exitPrice} (${reason}). PnL: $${pos.pnl.toFixed(2)}`);
      
      // APPLY COOLDOWN
      let cooldownMinutes = 15; // default
      if (reason === "STOP_LOSS" || reason === "STOPPED" || reason === "SL HIT") {
        cooldownMinutes = 30;
      } else if (reason === "TAKE_PROFIT" || reason === "TP HIT") {
        cooldownMinutes = 5;
      } else if (reason === "MANUAL") {
        cooldownMinutes = 10;
      }
      
      const cooldownMs = cooldownMinutes * 60 * 1000;
      this.symbolCooldowns.set(pos.symbol, Date.now() + cooldownMs);
      console.log(`[COOLDOWN_APPLIED] Added ${cooldownMinutes}m cooldown for ${pos.symbol}.`);

      // Update store balance to keep in sync
      if (pos.userId && typeof window !== "undefined") {
        useWalletStore.getState().fetchWallet(pos.userId).catch(() => {});
      }

      return true;
    } catch (err) {
      console.log(`[POSITION_REJECTED] Failed closing position ${positionId} in DB: ${err}`);
      console.error(`[PaperTrading] Failed closing position ${positionId} in DB:`, err);
      return false;
    }
  }
}
