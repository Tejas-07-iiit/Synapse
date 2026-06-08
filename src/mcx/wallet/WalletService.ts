import type { McxWallet, PrismaClient } from "@prisma/client";
import prisma from "@/lib/prisma";
import { mcxConfig } from "../config/mcx.config";
import { MCXEventBus, MCXEventType } from "../events/EventBus";

const riskConfigVersion = "mcx-risk-v2";
type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

export class WalletService {
  static initialize() {}

  static async getWallet(userId: string, db: Tx | PrismaClient = prisma): Promise<McxWallet> {
    const existing = await db.mcxWallet.findUnique({ where: { userId } });
    if (existing) return existing;
    const equity = mcxConfig.runtime.defaultWalletEquity;
    return db.mcxWallet.create({
      data: {
        userId,
        equity,
        availableBalance: equity,
        blockedMargin: 0,
        realizedPnL: 0,
        unrealizedPnL: 0,
        dayStartEquity: equity,
        highWatermarkEquity: equity,
        tradingHalted: false,
        riskConfigVersion,
      },
    });
  }

  static async refreshUnrealizedPnL(userId: string, db: Tx | PrismaClient = prisma) {
    const [wallet, positions] = await Promise.all([
      this.getWallet(userId, db),
      db.mcxPosition.findMany({ where: { userId, status: "OPEN" } }),
    ]);
    const unrealizedPnL = positions.reduce((sum, position) => sum + position.unrealizedPnL, 0);
    const equity = wallet.availableBalance + wallet.blockedMargin + wallet.realizedPnL + unrealizedPnL;
    const updated = await db.mcxWallet.update({
      where: { userId },
      data: {
        unrealizedPnL,
        equity,
        highWatermarkEquity: Math.max(wallet.highWatermarkEquity, equity),
      },
    });
    MCXEventBus.publish(MCXEventType.WALLET_UPDATED, {
      userId,
      equity: updated.equity,
      availableBalance: updated.availableBalance,
      blockedMargin: updated.blockedMargin,
      realizedPnL: updated.realizedPnL,
      unrealizedPnL: updated.unrealizedPnL,
    });
    return updated;
  }
}
