import type { McxPosition } from "@prisma/client";
import prisma from "@/lib/prisma";
import { MCXEventBus, MCXEventType } from "../events/EventBus";
import { IndicatorEngine } from "../indicators/IndicatorEngine";
import { MarketDataService } from "../market-data/MarketDataService";
import { RiskEngine } from "../risk/RiskEngine";
import { mcxConfig } from "../config/mcx.config";
import type { MCXExitReason, MCXSignal } from "../types";
import { mcxLogger } from "../utils/logger";
import { WalletService } from "../wallet/WalletService";
import { LockManager } from "./LockManager";

function tradeId(prefix: string, userId: string, symbol: string) {
  return `${prefix}-${userId}-${symbol}-${Date.now()}`;
}

export class ExecutionService {
  private static initialized = false;

  static initialize() {
    if (this.initialized) return;
    this.initialized = true;
    MCXEventBus.on(MCXEventType.SIGNAL_GENERATED, (signal) => void this.executeEntry(signal as MCXSignal));
    MCXEventBus.on(MCXEventType.PRICE_TICK, (tick) => void this.onTick(String((tick as any).symbol), Number((tick as any).price)));
    mcxLogger.info("ExecutionService Initialized");
  }

  static async executeEntry(signal: MCXSignal) {
    if (signal.direction === "HOLD") return null;
    const symbol = signal.symbol.toUpperCase();

    if (signal.userId === mcxConfig.runtime.defaultUserId) {
      const users = await prisma.user.findMany();
      mcxLogger.info(`Fanning out signal ${signal.strategyName} on ${symbol} to ${users.length} users`);
      const results = [];
      for (const user of users) {
        const wallet = await WalletService.getWallet(user.id);
        if (!wallet.tradingHalted) {
          const userSignal = { ...signal, userId: user.id };
          const posId = await this.executeForUser(userSignal);
          if (posId) results.push({ userId: user.id, positionId: posId });
        }
      }
      // Also execute for SYSTEM_MCX_USER if they have a wallet and it's not halted
      const systemWallet = await WalletService.getWallet(mcxConfig.runtime.defaultUserId);
      if (!systemWallet.tradingHalted) {
        const systemSignal = { ...signal, userId: mcxConfig.runtime.defaultUserId };
        const posId = await this.executeForUser(systemSignal);
        if (posId) results.push({ userId: mcxConfig.runtime.defaultUserId, positionId: posId });
      }
      return results.length > 0 ? results[0].positionId : null;
    } else {
      return this.executeForUser(signal);
    }
  }

  private static async executeForUser(signal: MCXSignal): Promise<string | null> {
    const symbol = signal.symbol.toUpperCase();
    const lockKey = `${signal.userId}:${symbol}`;
    if (!(await LockManager.acquire(lockKey))) return null;
    try {
      const created = await prisma.$transaction(async (tx) => {
        const wallet = await WalletService.getWallet(signal.userId, tx);
        const sizing = RiskEngine.calculatePositionSize(wallet, signal);
        await RiskEngine.validateEntry(signal.userId, wallet, signal, sizing, tx);
        const contract = await MarketDataService.resolveContract(symbol);
        const side = signal.direction === "BUY" ? "LONG" : "SHORT";
        const position = await tx.mcxPosition.create({
          data: {
            openKey: `${signal.userId}:${symbol}`,
            userId: signal.userId,
            symbol,
            token: contract.token,
            exchange: contract.exchange,
            expiry: contract.expiry,
            contractName: contract.contractName,
            side,
            status: "OPEN",
            entryPrice: signal.entryPrice,
            currentPrice: signal.entryPrice,
            stopLoss: signal.stopLoss,
            takeProfit: signal.takeProfit,
            quantity: sizing.quantity,
            lots: sizing.lots,
            pointValue: sizing.pointValue,
            marginUsed: sizing.marginRequired,
            riskAmount: sizing.riskAmount,
            pnl: 0,
            unrealizedPnL: 0,
            strategyId: signal.strategyId,
            strategyName: signal.strategyName,
            confidence: signal.confidence,
          },
        });
        await tx.mcxTrade.create({
          data: {
            tradeId: tradeId("ENTRY", signal.userId, symbol),
            userId: signal.userId,
            positionId: position.id,
            symbol,
            token: contract.token,
            exchange: contract.exchange,
            expiry: contract.expiry,
            contractName: contract.contractName,
            side,
            type: "ENTRY",
            lots: sizing.lots,
            quantity: sizing.quantity,
            price: signal.entryPrice,
            entryPrice: signal.entryPrice,
            stopLoss: signal.stopLoss,
            takeProfit: signal.takeProfit,
            strategy: signal.strategyName,
            aiConfidence: signal.confidence,
            profit: 0,
            status: "OPEN",
            idempotencyKey: `ENTRY:${signal.userId}:${symbol}:${signal.generatedAt.getTime()}`,
          },
        });
        await tx.mcxWallet.update({
          where: { userId: signal.userId },
          data: {
            availableBalance: { decrement: sizing.marginRequired },
            blockedMargin: { increment: sizing.marginRequired },
          },
        });
        return position;
      });
      MCXEventBus.publish(MCXEventType.POSITION_OPENED, { userId: signal.userId, symbol, positionId: created.id });
      return created.id;
    } catch (error: any) {
      mcxLogger.error("ENTRY_FAILED", { userId: signal.userId, symbol, error: error.message });
      return null;
    } finally {
      await LockManager.release(lockKey);
    }
  }

  static pnlFor(position: Pick<McxPosition, "side" | "entryPrice" | "lots" | "pointValue">, price: number): number {
    return position.side === "LONG" ? (price - position.entryPrice) * position.lots * position.pointValue : (position.entryPrice - price) * position.lots * position.pointValue;
  }

  static async onTick(symbol: string, price: number) {
    const positions = await prisma.mcxPosition.findMany({ where: { symbol: symbol.toUpperCase(), status: "OPEN" } });
    for (const position of positions) {
      const trailingStop = await this.nextTrailingStop(position, price);
      const unrealizedPnL = this.pnlFor(position, price);
      const updated = await prisma.mcxPosition.update({
        where: { id: position.id },
        data: { currentPrice: price, unrealizedPnL, trailingStop },
      });
      await WalletService.refreshUnrealizedPnL(position.userId);
      const stop = updated.trailingStop ?? updated.stopLoss;
      const slHit = updated.side === "LONG" ? price <= stop : price >= stop;
      const tpHit = updated.side === "LONG" ? price >= updated.takeProfit : price <= updated.takeProfit;
      if (slHit) await this.executeExit(updated.userId, updated.symbol, price, updated.trailingStop ? "TRAILING_SL" : "SL");
      else if (tpHit) await this.executeExit(updated.userId, updated.symbol, price, "TP");
    }
  }

  static async nextTrailingStop(position: McxPosition, price: number): Promise<number | null> {
    const candles = await prisma.mcxCandle.findMany({
      where: { symbol: position.symbol, interval: "1m", isClosed: true },
      orderBy: { timestamp: "desc" },
      take: 30,
    });
    const atr = IndicatorEngine.calculate(candles.reverse()).atr;
    if (!atr) return position.trailingStop;
    if (position.side === "LONG") {
      const proposed = price - atr;
      if (proposed > position.stopLoss && (!position.trailingStop || proposed > position.trailingStop)) return proposed;
    } else {
      const proposed = price + atr;
      if (proposed < position.stopLoss && (!position.trailingStop || proposed < position.trailingStop)) return proposed;
    }
    return position.trailingStop;
  }

  static async executeExit(userId: string, symbol: string, price: number, reason: MCXExitReason) {
    const normalized = symbol.toUpperCase();
    const lockKey = `${userId}:${normalized}`;
    if (!(await LockManager.acquire(lockKey))) return null;
    try {
      const result = await prisma.$transaction(async (tx) => {
        const position = await tx.mcxPosition.findFirst({ where: { userId, symbol: normalized, status: "OPEN" } });
        if (!position) throw new Error("Open MCX position not found");
        const pnl = this.pnlFor(position, price);
        await tx.mcxPosition.update({
          where: { id: position.id },
          data: {
            openKey: null,
            status: "CLOSED",
            exitPrice: price,
            currentPrice: price,
            pnl,
            unrealizedPnL: 0,
            closedAt: new Date(),
            exitReason: reason,
          },
        });
        await tx.mcxTrade.create({
          data: {
            tradeId: tradeId("EXIT", userId, normalized),
            userId,
            positionId: position.id,
            symbol: normalized,
            token: position.token,
            exchange: position.exchange,
            expiry: position.expiry,
            contractName: position.contractName,
            side: position.side,
            type: "EXIT",
            lots: position.lots,
            quantity: position.quantity,
            price,
            entryPrice: position.entryPrice,
            exitPrice: price,
            stopLoss: position.stopLoss,
            takeProfit: position.takeProfit,
            strategy: position.strategyName,
            aiConfidence: position.confidence,
            profit: pnl,
            status: reason === "TP" ? "TP HIT" : reason,
            reason,
            idempotencyKey: `EXIT:${userId}:${normalized}:${position.id}`,
          },
        });
        const wallet = await tx.mcxWallet.update({
          where: { userId },
          data: {
            availableBalance: { increment: position.marginUsed + pnl },
            blockedMargin: { decrement: position.marginUsed },
            realizedPnL: { increment: pnl },
          },
        });
        return { pnl, wallet };
      });
      if (reason === "TP") MCXEventBus.publish(MCXEventType.TP_TRIGGERED, { userId, symbol: normalized, price, pnl: result.pnl });
      else MCXEventBus.publish(MCXEventType.SL_TRIGGERED, { userId, symbol: normalized, price, pnl: result.pnl, reason });
      MCXEventBus.publish(reason === "TP" ? MCXEventType.TP_HIT : MCXEventType.SL_HIT, { userId, symbol: normalized, pnl: result.pnl });
      MCXEventBus.publish(MCXEventType.POSITION_CLOSED, { userId, symbol: normalized, pnl: result.pnl, reason });
      const wallet = await WalletService.refreshUnrealizedPnL(userId);
      await RiskEngine.enforceDailyRiskLock(wallet);
      return result.pnl;
    } catch (error: any) {
      mcxLogger.error("EXIT_FAILED", { userId, symbol: normalized, reason, error: error.message });
      return null;
    } finally {
      await LockManager.release(lockKey);
    }
  }
}
