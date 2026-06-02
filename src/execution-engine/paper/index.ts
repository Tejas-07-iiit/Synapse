import { VirtualPosition, VirtualOrder } from "../types";
import { RiskEngine, RiskCheckSettings } from "../risk";
import { useWalletStore } from "@/src/stores/walletStore";
import { useSettingsStore } from "@/src/stores/settingsStore";
import { AuditLogger } from "../../lib/audit/trading-audit";
import prisma from "../../../lib/prisma";

export interface PaperTradingSettings {
  autoTrading: boolean;
  maxOpenTrades: number;
  preferredTradingMode?: "SCALPING" | "INTRADAY";
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
          auditPayload: pos.auditPayload || undefined,
          expiresAt: pos.expiresAt ? new Date(pos.expiresAt).getTime() : undefined,
          exitReason: pos.exitReason || undefined,
          confidenceScore: pos.confidenceScore || undefined,
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
  public static async updatePrices(symbol: string, currentPrice: number, currentHigh?: number, currentLow?: number) {
    const sym = symbol.toUpperCase();
    const activePositions = Array.from(this.positions.values()).filter(
      (p) => p.symbol === sym && p.status === "OPEN"
    );

    for (const pos of activePositions) {
      if (pos.expiresAt && Date.now() >= new Date(pos.expiresAt).getTime()) {
        await this.closePosition(pos.id, currentPrice, "TRADE_TIMEOUT");
        continue;
      }

      pos.currentPrice = currentPrice;

      // Calculate floating PnL
      const entryVal = pos.entryPrice * pos.quantity;
      const currentVal = currentPrice * pos.quantity;
      if (pos.direction === "LONG") {
        pos.pnl = (currentVal - entryVal);
      } else {
        pos.pnl = (entryVal - currentVal);
      }

      // Update in DB (non-blocking) via API, throttled to once every 10 seconds
      const now = Date.now();
      const lastUpdate = this.lastDbUpdate.get(pos.id) || 0;
      if (now - lastUpdate > 300000) { // Log monitor every 5 minutes (300000ms) to avoid spam
        this.lastDbUpdate.set(pos.id, now);
        
        let distTp = null;
        let distSl = null;
        if (pos.takeProfit) {
          distTp = Math.abs(currentPrice - pos.takeProfit) / currentPrice * 100;
        }
        if (pos.stopLoss) {
          distSl = Math.abs(currentPrice - pos.stopLoss) / currentPrice * 100;
        }
        
        AuditLogger.logPositionMonitor({
          symbol: sym,
          positionId: pos.id,
          currentPrice,
          entry: pos.entryPrice,
          sl: pos.stopLoss,
          tp: pos.takeProfit,
          distanceToTpPct: distTp ? Number(distTp.toFixed(2)) : null,
          distanceToSlPct: distSl ? Number(distSl.toFixed(2)) : null,
        });
        
        if (this.dbHandler) {
          this.dbHandler.updatePosition(pos.id, currentPrice, pos.pnl).catch((err) => {
            AuditLogger.logDatabaseError({ action: "updatePosition", message: `Failed to update pos ${pos.id}`, errorDetails: err });
          });
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

      // Check Stop Loss & Take Profit exits using absolute wick extremes if available
      let shouldClose = false;
      let exitReason = "";
      let executionPrice = currentPrice;
      
      const lowestPrice = currentLow !== undefined ? currentLow : currentPrice;
      const highestPrice = currentHigh !== undefined ? currentHigh : currentPrice;

      if (pos.direction === "LONG") {
        if (pos.stopLoss && lowestPrice <= pos.stopLoss) {
          shouldClose = true;
          exitReason = "STOP_LOSS";
          executionPrice = pos.stopLoss;
        } else if (pos.takeProfit && highestPrice >= pos.takeProfit) {
          shouldClose = true;
          exitReason = "TAKE_PROFIT";
          executionPrice = pos.takeProfit;
        }
      } else {
        if (pos.stopLoss && highestPrice >= pos.stopLoss) {
          shouldClose = true;
          exitReason = "STOP_LOSS";
          executionPrice = pos.stopLoss;
        } else if (pos.takeProfit && lowestPrice <= pos.takeProfit) {
          shouldClose = true;
          exitReason = "TAKE_PROFIT";
          executionPrice = pos.takeProfit;
        }
      }

      if (shouldClose) {
        await this.closePosition(pos.id, executionPrice, exitReason);
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
      return null;
    }
    this.executionLocks.add(sym);

    try {
      const strategyId = signalContext?.strategyId || "manual";
      const strategyName = signalContext?.strategyName || "Manual Trade";
      const strategyCategory = signalContext?.strategyCategory || "Manual";
      const entryReason = signalContext?.reasoning ? signalContext.reasoning.join(". ") : "Manual execution by user.";
      const confidenceAtEntry = signalContext?.confidence !== undefined ? signalContext.confidence / 100 : 1.0;
      const marketRegime = signalContext?.marketContext?.regime || "UNKNOWN";
      const indicatorSnapshot = signalContext?.indicators || {};
      const auditPayload = signalContext?.auditPayload || null;

      // 1.5 CHECK COOLDOWN
      const cooldownExpiry = this.symbolCooldowns.get(sym) || 0;
      if (Date.now() < cooldownExpiry) {
        return null;
      }

      // Check if position already exists for symbol in memory
      let alreadyOpen = Array.from(this.positions.values()).some(
        (p) => p.symbol === sym && p.status === "OPEN" && p.userId === userId
      );

      if (alreadyOpen) {
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
          return null;
        }
      } catch (e) {
        AuditLogger.logSystemError({ module: "PaperTradingEngine", message: "Database position lock check failed", errorDetails: e });
      }

      // Calculate risk/block parameters beforehand
      const alreadyOpenForStrategy = Array.from(this.positions.values()).some(
        (p) => p.userId === userId && p.status === "OPEN" && p.strategyId === strategyId && strategyId !== "manual"
      );
      const alreadyOpenInSameDirection = Array.from(this.positions.values()).some(
        (p) => p.userId === userId && p.status === "OPEN" && p.direction === direction && p.symbol !== sym
      );

      // Compute Daily Drawdown
      let dailyDrawdownPercent = 0;
      try {
        if (this.dbHandler) {
          const startOfToday = new Date();
          startOfToday.setUTCHours(0, 0, 0, 0);

          const closedTradesToday = await prisma.trade.findMany({
            where: {
              userId,
              closedAt: {
                gte: startOfToday,
              },
            },
            select: {
              netPnl: true,
            },
          });

          const closedPnlToday = closedTradesToday.reduce((sum, t) => sum + t.netPnl, 0);

          const openPositions = Array.from(this.positions.values()).filter(
            (p) => p.userId === userId && p.status === "OPEN"
          );
          const floatingPnl = openPositions.reduce((sum, p) => sum + p.pnl, 0);

          const totalDailyPnl = closedPnlToday + floatingPnl;
          
          const wallet = await prisma.wallet.findUnique({ where: { userId } });
          const currentBalance = wallet ? wallet.balance : (explicitBalance !== undefined ? explicitBalance : 0);
          const startOfDayBalance = currentBalance - closedPnlToday;

          if (startOfDayBalance > 0 && totalDailyPnl < 0) {
            dailyDrawdownPercent = (Math.abs(totalDailyPnl) / startOfDayBalance) * 100;
          }
        }
      } catch (e) {
        console.error("[PaperTradingEngine] Error calculating daily drawdown:", e);
      }

      let balance = explicitBalance !== undefined ? explicitBalance : 0;
      if (explicitBalance === undefined) {
        balance = useWalletStore.getState().balance;
      }
      
      const settings = explicitSettings || useSettingsStore.getState();

      let orderValueUsdt = 0;
      let confidenceScore = 100;
      let pct = 10; // default fallback percentage

      let confidence = 70;
      if (signalContext && signalContext.confidence !== undefined) {
        confidence = signalContext.confidence;
      }
      confidenceScore = Math.round(confidence);

      if (sizeUsdt === null) {
        if (confidence < 60) {
          pct = 5 + (confidence / 60) * 5;
        } else if (confidence <= 80) {
          pct = 10 + ((confidence - 60) / 20) * 15;
        } else {
          pct = 25 + ((confidence - 80) / 20) * 5;
        }

        // Safety Rules for >30% sizing (Confidence > 90)
        if (confidence > 90) {
          const isSafetyMet =
            marketRegime === "TRENDING" &&
            dailyDrawdownPercent < 2 &&
            !alreadyOpenInSameDirection;

          if (isSafetyMet) {
            pct = 30 + ((confidence - 90) / 10) * 20;
          } else {
            pct = 30; // clamp to recommended max of 30% if safety is not met
          }
        }

        pct = Math.min(50, Math.max(5, pct));
        orderValueUsdt = balance * (pct / 100) * leverage;
        console.log(`[DYNAMIC_SIZING] Confidence: ${confidence} | Regime: ${marketRegime} | Drawdown: ${dailyDrawdownPercent.toFixed(2)}% | Calculated Pct: ${pct.toFixed(2)}% | Order size: $${orderValueUsdt.toFixed(2)}`);
      } else {
        orderValueUsdt = sizeUsdt;
        pct = (orderValueUsdt / balance) * 100;
      }
      
      console.log(`[POSITION_SIZING] Wallet balance: $${balance.toFixed(2)} | Risk per trade pct used: ${(orderValueUsdt / balance / leverage * 100).toFixed(2)}% | Leverage: ${leverage}x | Calculated order size: $${orderValueUsdt.toFixed(2)}`);

      if (orderValueUsdt <= 0 || isNaN(orderValueUsdt)) {
        console.log(`[POSITION_REJECTED] Invalid position size calculated: $${orderValueUsdt.toFixed(2)}. Aborting.`);
        return null;
      }

      const qty = orderValueUsdt / price;

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

      // Compute total correlated exposure (sum of current open same-direction positions on other assets)
      const correlatedExposureUsdt = Array.from(this.positions.values())
        .filter((p) => p.userId === userId && p.status === "OPEN" && p.direction === direction && p.symbol !== sym)
        .reduce((sum, p) => sum + (p.entryPrice * p.quantity), 0);
      const totalCorrelatedExposure = correlatedExposureUsdt + orderValueUsdt;

      const correlationBlocked = alreadyOpenInSameDirection && (
        confidenceScore < 90 || totalCorrelatedExposure > balance * 0.50
      );

      const riskResult = RiskEngine.validateOrder(
        dummyOrder, 
        userActivePositionsCount, 
        alreadyOpen,
        leverage,
        availableBalance,
        explicitSettings,
        alreadyOpenForStrategy,
        correlationBlocked
      );
      if (!riskResult.allowed) {
        AuditLogger.logRiskRejected({ userId, symbol: sym, reason: riskResult.reason || "Risk Engine rejected order" });
        return null;
      }

      // Risk Reward Enforcement (RR >= 1.5)
      if (stopLoss !== null && takeProfit !== null) {
        const risk = Math.abs(price - stopLoss);
        const reward = Math.abs(takeProfit - price);
        if (risk > 0) {
          const rr = reward / risk;
          if (rr < 1.5) {
            const minReward = risk * 1.5;
            const oldTp = takeProfit;
            takeProfit = direction === "LONG" ? price + minReward : price - minReward;
            console.log(`[RR Guard] Adjusted TP from ${oldTp.toFixed(4)} to ${takeProfit.toFixed(4)} to enforce 1.5 RR.`);
          }
        }
      }

      // Calculate expiresAt based on preferredTradingMode architecture
      const tradingMode = settings.preferredTradingMode || "INTRADAY";
      const openedAtTime = Date.now();
      
      // ARCHITECTURE: Scalping (45m timeout) | Intraday (8h timeout)
      const expiresAt = tradingMode === "SCALPING" 
        ? new Date(openedAtTime + 45 * 60 * 1000) 
        : new Date(openedAtTime + 8 * 60 * 60 * 1000);

      try {
        console.log(`[DB_WRITE] Dispatching position open transaction to database for ${sym}`);
        let dbPos: any = null;

        // Enrich auditPayload with final sizing
        let finalAuditPayload = auditPayload;
        if (finalAuditPayload) {
          try {
            finalAuditPayload = JSON.parse(JSON.stringify(finalAuditPayload));
            if (finalAuditPayload.tradePlan) {
              finalAuditPayload.tradePlan.sizeUsdt = Number(orderValueUsdt.toFixed(2));
              finalAuditPayload.tradePlan.quantity = Number(qty.toFixed(6));
            }
          } catch (e) {
            console.error("[PaperTrading] Failed to enrich auditPayload sizing:", e);
          }
        }

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
            auditPayload: finalAuditPayload,
            expiresAt: expiresAt.toISOString(),
            confidenceScore,
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
                auditPayload: finalAuditPayload,
                expiresAt: expiresAt.toISOString(),
                confidenceScore,
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
          auditPayload: dbPos.auditPayload || undefined,
          expiresAt: expiresAt.getTime(),
          confidenceScore,
        };

        this.positions.set(position.id, position);
        
        // Temporary debug log for dynamic SL/TP verification
        let atrVal = signalContext?.auditPayload?.marketSnapshot?.volatility || 
                     (signalContext?.indicators?.atr ? signalContext.indicators.atr[signalContext.indicators.atr.length - 1] : 0);
        if (!atrVal && stopLoss && price) {
          const slMult = (settings.preferredTradingMode || "INTRADAY") === "SCALPING" ? 0.8 : 1.5;
          atrVal = Math.abs(price - stopLoss) / slMult;
        }
        const mode = settings.preferredTradingMode || "INTRADAY";
        
        console.log(`\n[DYNAMIC-SLTP]\nUser: ${userId}\nMode: ${mode}\nStrategy: ${strategyName}\nATR: ${atrVal.toFixed(4)}\nEntry: ${price.toFixed(2)}\nSL: ${stopLoss ? stopLoss.toFixed(2) : "N/A"}\nTP: ${takeProfit ? takeProfit.toFixed(2) : "N/A"}\n`);

        // Dynamic Position Sizing Debug Log
        console.log(`\n[DYNAMIC POSITION SIZING]\nUser: ${userId}\nMode: ${mode}\nStrategy: ${strategyName}\nConfidence: ${confidenceScore}\nRegime: ${position.marketRegime || "UNKNOWN"}\nWallet: $${balance.toFixed(2)}\nAllocation: ${pct.toFixed(2)}%\nPosition Size: $${orderValueUsdt.toFixed(2)}\n`);

        console.log(`[POSITION_OPENED] ✅ Opened position: ${direction} ${sym} at $${price} | Qty: ${qty.toFixed(6)} | SL: ${stopLoss} | TP: ${takeProfit} | Expires: ${expiresAt.toISOString()}`);
        
        // Update store balance to keep in sync
        if (typeof window !== "undefined") {
          useWalletStore.getState().fetchWallet(userId, true).catch(() => {});
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
      : reason === "TIMEOUT" || reason === "TRADE_TIMEOUT"
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
          auditPayload: pos.auditPayload,
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
              auditPayload: pos.auditPayload,
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
        useWalletStore.getState().fetchWallet(pos.userId, true).catch(() => {});
      }

      return true;
    } catch (err) {
      console.log(`[POSITION_REJECTED] Failed closing position ${positionId} in DB: ${err}`);
      console.error(`[PaperTrading] Failed closing position ${positionId} in DB:`, err);
      return false;
    }
  }
}
