import prisma from "@/lib/prisma";

export async function ensureUserExists(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      wallet: true,
      settings: true,
    }
  });

  if (!user) {
    return await prisma.user.create({
      data: {
        id: userId,
        username: userId === "default-user-id" ? "default_user" : `user_${userId.slice(0, 8)}`,
        email: userId === "default-user-id" ? "default@synapse.ai" : `user_${userId.slice(0, 8)}@synapse.ai`,
        passwordHash: "default_password_hash",
        wallet: {
          create: {
            balance: 10000.0,
            totalDeposited: 10000.0,
            totalWithdrawn: 0.0,
            realizedPnl: 0.0,
          }
        },
        settings: {
          create: {
            autoTrading: true,
            riskPerTradePct: 2.0,
            maxOpenTrades: 3,
            defaultSlPct: 1.5,
            defaultTpPct: 3.0,
            prefSymbol: "BTCUSDT",
          }
        }
      },
      include: {
        wallet: true,
        settings: true,
      }
    });
  }

  // Ensure relations exist for an existing user (migration fallback)
  if (!user.wallet) {
    await prisma.wallet.create({
      data: {
        userId: user.id,
        balance: 10000.0,
        totalDeposited: 10000.0,
      }
    });
  }
  
  if (!user.settings) {
    await prisma.userSettings.create({
      data: {
        userId: user.id,
      }
    });
  }

  return user;
}
