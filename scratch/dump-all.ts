import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== DB DUMP ===");
  try {
    const users = await prisma.user.findMany({ include: { wallet: true, settings: true, trades: true, positions: true } });
    console.log("USERS:", JSON.stringify(users, null, 2));

    const allTrades = await prisma.trade.findMany();
    console.log("ALL TRADES COUNT:", allTrades.length);
    if (allTrades.length > 0) {
      console.log("ALL TRADES:", JSON.stringify(allTrades.slice(0, 10), null, 2));
    }

    const allPositions = await prisma.position.findMany();
    console.log("ALL POSITIONS COUNT:", allPositions.length);
    if (allPositions.length > 0) {
      console.log("ALL POSITIONS:", JSON.stringify(allPositions.slice(0, 10), null, 2));
    }

    const allWallets = await prisma.wallet.findMany();
    console.log("ALL WALLETS:", JSON.stringify(allWallets, null, 2));
  } catch (err) {
    console.error("Error dumping DB:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
