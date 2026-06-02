import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: {
      settings: true,
      wallet: true,
      positions: {
        where: { status: "OPEN" }
      }
    }
  });

  console.log("=== DB CHECK ===");
  console.log(`Found ${users.length} users:`);
  for (const u of users) {
    console.log(`- Username: ${u.username}, ID: ${u.id}`);
    console.log(`  AutoTrading: ${u.settings?.autoTrading}`);
    console.log(`  Wallet Balance: ${u.wallet?.balance}`);
    console.log(`  Open Positions count: ${u.positions.length}`);
    for (const pos of u.positions) {
      console.log(`    * ID: ${pos.id}, Symbol: ${pos.symbol}, Dir: ${pos.direction}, Entry: ${pos.entryPrice}, Qty: ${pos.quantity}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
