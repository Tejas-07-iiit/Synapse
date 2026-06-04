
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const settings = await prisma.userSettings.findMany({
    include: {
      user: {
        select: { username: true }
      }
    }
  });

  console.log("Username | UserID | Mode | AutoTrading");
  console.log("---------------------------------------");
  for (const s of settings) {
    console.log(`${(s.user as any).username.padEnd(10)} | ${s.userId.padEnd(36)} | ${s.preferredTradingMode.padEnd(10)} | ${s.autoTrading}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
