import type { McxWallet, PrismaClient } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getMCXSymbolConfig, mcxConfig } from "../config/mcx.config";
import { MCXEventBus, MCXEventType } from "../events/EventBus";
import type { MCXSignal, PositionSizingResult } from "../types";

type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

export class RiskEngine {
  static calculatePositionSize(wallet: McxWallet, signal: MCXSignal): PositionSizingResult {
    const symbolConfig = getMCXSymbolConfig(signal.symbol);
    const stopDistance = Math.abs(signal.entryPrice - signal.stopLoss);
    if (stopDistance <= 0) throw new Error("Stop distance must be greater than zero");
    const riskAmount = wallet.equity * mcxConfig.risk.maxRiskPerTradePct;
    const lots = Math.floor(riskAmount / (stopDistance * symbolConfig.pointValue));
    if (lots < 1) throw new Error("Risk amount is too small for one lot at the configured stop distance");
    return {
      lots,
      quantity: lots * symbolConfig.lotSize,
      riskAmount,
      stopDistance,
      pointValue: symbolConfig.pointValue,
      marginRequired: lots * symbolConfig.marginPerLot,
    };
  }

  static async validateEntry(userId: string, wallet: McxWallet, signal: MCXSignal, sizing: PositionSizingResult, db: Tx | PrismaClient = prisma) {
    if (wallet.tradingHalted) throw new Error(`MCX trading halted: ${wallet.haltReason || "risk lock"}`);
    if (signal.confidence < mcxConfig.risk.minConfidence) throw new Error("Signal confidence below configured threshold");
    const [openCount, sameSymbol, exposure] = await Promise.all([
      db.mcxPosition.count({ where: { userId, status: "OPEN" } }),
      db.mcxPosition.findFirst({ where: { userId, symbol: signal.symbol, status: "OPEN" } }),
      db.mcxPosition.aggregate({ where: { userId, status: "OPEN" }, _sum: { marginUsed: true } }),
    ]);
    if (sameSymbol) throw new Error("Duplicate open position for user and symbol is blocked");
    if (openCount >= mcxConfig.risk.maxSimultaneousPositions) throw new Error("Max simultaneous MCX positions reached");
    const totalExposure = (exposure._sum.marginUsed || 0) + sizing.marginRequired;
    if (totalExposure > wallet.equity * mcxConfig.risk.maxPortfolioExposurePct) throw new Error("Max portfolio exposure exceeded");
    if (wallet.availableBalance < sizing.marginRequired) throw new Error("Insufficient available MCX wallet balance");
  }

  static async enforceDailyRiskLock(wallet: McxWallet, db: Tx | PrismaClient = prisma) {
    const dailyLoss = Math.max(0, wallet.dayStartEquity - wallet.equity);
    const drawdown = Math.max(0, wallet.highWatermarkEquity - wallet.equity);
    const dailyLimitHit = dailyLoss >= wallet.dayStartEquity * mcxConfig.risk.dailyLossLimitPct;
    const drawdownHit = drawdown >= wallet.highWatermarkEquity * mcxConfig.risk.dailyDrawdownLockPct;
    if (!dailyLimitHit && !drawdownHit) return wallet;
    const updated = await db.mcxWallet.update({
      where: { userId: wallet.userId },
      data: {
        tradingHalted: true,
        haltReason: dailyLimitHit ? "DAILY_LOSS_LIMIT" : "DAILY_DRAWDOWN_LOCK",
      },
    });
    MCXEventBus.publish(MCXEventType.TRADING_HALTED, { userId: wallet.userId, reason: updated.haltReason });
    return updated;
  }
}
