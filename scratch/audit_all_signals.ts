
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Checking TradeSignals for all users in the last 24 hours...");
  const signals = await prisma.tradeSignal.findMany({
    where: {
      timestamp: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
      }
    },
    include: {
      user: {
        include: {
          settings: true
        }
      }
    },
    orderBy: { timestamp: "desc" }
  });

  console.log("Symbol | User | Signal Mode | DB Current Mode");
  console.log("----------------------------------------------");
  for (const s of signals) {
    const username = (s as any).user?.username || "N/A";
    const signalMode = s.tradingMode || "NULL";
    const currentMode = (s as any).user?.settings?.preferredTradingMode || "N/A";
    console.log(`${s.symbol.padEnd(8)} | ${username.padEnd(15)} | ${signalMode.padEnd(10)} | ${currentMode}`);
  }
}

main().finally(() => prisma.$disconnect());
