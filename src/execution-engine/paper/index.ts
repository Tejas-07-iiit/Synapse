import { VirtualPosition, VirtualOrder } from "../types";
import { RiskEngine } from "../risk";
import { useWalletStore } from "@/src/stores/walletStore";
import { useSettingsStore } from "@/src/stores/settingsStore";

export class PaperTradingEngine {
  private static positions: Map<string, VirtualPosition> = new Map(); // positionId -> Position
  private static lastDbUpdate: Map<string, number> = new Map(); // positionId -> timestamp

  /**
   * Initializes virtual positions by loading any open ones from the database on startup.
   */
  public static async loadActivePositions(userId: string) {
    try {
      const res = await fetch(`/api/positions?userId=${encodeURIComponent(userId)}`);
      const body = await res.json();
      
      if (body.success && Array.isArray(body.positions)) {
        this.positions.clear();
        for (const pos of body.positions) {
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
          });
        }
        console.log(`[PaperTrading] Loaded ${body.positions.length} active positions from database.`);
      }
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
        fetch("/api/positions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update",
            data: { id: pos.id, currentPrice, pnl: pos.pnl },
          }),
        }).catch(() => {});
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
    leverage: number = 1
  ): Promise<VirtualPosition | null> {
    const sym = symbol.toUpperCase();

    console.log(`[PAPER_TRADING] Attempting to open position: ${direction} ${sym} @ $${price}`);

    // Check if position already exists for symbol in memory
    let alreadyOpen = Array.from(this.positions.values()).some(
      (p) => p.symbol === sym && p.status === "OPEN" && p.userId === userId
    );

    if (alreadyOpen) {
      console.log(`[POSITION_LOCK] ${sym} blocked → existing active trade found`);
      console.log(`[TRADE_REJECTED] Reason: Active position already exists for ${sym}`);
      return null;
    }

    // Double-check database via API call to be absolutely sure
    try {
      const res = await fetch(`/api/positions?userId=${encodeURIComponent(userId)}`);
      const body = await res.json();
      if (body.success && Array.isArray(body.positions)) {
        const dbOpen = body.positions.some(
          (p: { symbol: string; status: string }) => p.symbol === sym && p.status === "OPEN"
        );
        if (dbOpen) {
          alreadyOpen = true;
          console.log(`[POSITION_LOCK] ${sym} blocked → existing active trade found`);
          console.log(`[TRADE_REJECTED] Reason: Active position already exists for ${sym}`);
          return null;
        }
      }
    } catch (e) {
      console.warn("[PaperTradingEngine] Database position lock check failed, proceeding with in-memory state:", e);
    }

    console.log(`[TRADE_ALLOWED] No active position found for ${sym}`);

    let qty = 0;
    let orderValueUsdt = 0;

    const wallet = useWalletStore.getState();
    const settings = useSettingsStore.getState();

    if (sizeUsdt === null) {
      orderValueUsdt = wallet.balance * (settings.riskPerTradePct / 100) * leverage;
    } else {
      orderValueUsdt = sizeUsdt;
    }
    
    console.log(`[POSITION_SIZING] Wallet balance: $${wallet.balance.toFixed(2)} | Risk per trade: ${settings.riskPerTradePct}% | Leverage: ${leverage}x | Calculated order size: $${orderValueUsdt.toFixed(2)}`);

    if (orderValueUsdt <= 0 || isNaN(orderValueUsdt)) {
      console.log(`[POSITION_REJECTED] Invalid position size calculated: $${orderValueUsdt.toFixed(2)}. Aborting.`);
      return null;
    }

    qty = orderValueUsdt / price;

    if (qty <= 0 || isNaN(qty)) {
      console.log(`[POSITION_REJECTED] Invalid quantity calculated: ${qty}. Aborting.`);
      return null;
    }
    
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

    const riskResult = RiskEngine.validateOrder(dummyOrder, this.getOpenPositions().length, alreadyOpen);
    if (!riskResult.allowed) {
      return null;
    }

    try {
      console.log(`[DB_WRITE] Dispatching position open transaction to database for ${sym}`);
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
          },
        }),
      });

      const body = await res.json();
      if (!body.success) {
        throw new Error(body.error || "Failed to open position");
      }

      const dbPos = body.position;
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
      };

      this.positions.set(position.id, position);
      console.log(`[POSITION_OPENED] ✅ Opened position: ${direction} ${sym} at $${price} | Qty: ${qty.toFixed(6)} | SL: ${stopLoss} | TP: ${takeProfit}`);
      
      // Update store balance to keep in sync
      useWalletStore.getState().fetchWallet(userId).catch(() => {});

      return position;
    } catch (err) {
      console.log(`[POSITION_REJECTED] Database write failed: ${err}`);
      console.error("[PaperTrading] Failed to open position in DB:", err);
      return null;
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

    console.log(`[PAPER_TRADING] Closing position ${positionId} for ${pos.symbol} at exit price $${exitPrice} (Reason: ${reason})`);

    const closedAt = Date.now();
    pos.status = "CLOSED";
    pos.closedAt = closedAt;
    pos.currentPrice = exitPrice;

    // Calculate final PnL
    const entryVal = pos.entryPrice * pos.quantity;
    const exitVal = exitPrice * pos.quantity;
    if (pos.direction === "LONG") {
      pos.pnl = (exitVal - entryVal) * pos.leverage;
    } else {
      pos.pnl = (entryVal - exitVal) * pos.leverage;
    }

    try {
      console.log(`[DB_WRITE] Dispatching position close transaction to database for ID: ${positionId}`);
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
          },
        }),
      });

      const body = await res.json();
      if (!body.success) {
        throw new Error(body.error || "Failed to close position");
      }

      this.positions.delete(positionId);
      console.log(`[POSITION_CLOSED] ✅ Closed position: ${pos.direction} ${pos.symbol} at $${exitPrice} (${reason}). PnL: $${pos.pnl.toFixed(2)}`);
      
      // Update store balance to keep in sync
      if (pos.userId) {
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
