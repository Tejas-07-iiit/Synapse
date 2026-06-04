
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: {
      settings: true
    }
  });

  console.log("UserID | Username | DB Mode | Auto Trading | Mismatch?");
  console.log("---------------------------------------------------------");
  for (const user of users) {
    const settings = user.settings;
    const dbMode = settings?.preferredTradingMode || "NULL";
    const autoTrading = settings?.autoTrading || false;
    
    // Check if the username indicates an expected mode (e.g. "tejas intraday" expecting INTRADAY)
    let expectedMode = "UNKNOWN";
    if (user.username.toLowerCase().includes("intraday")) {
      expectedMode = "INTRADAY";
    } else if (user.username.toLowerCase().includes("scalp") || user.username === "tejas 1") {
      expectedMode = "SCALPING"; // "tejas 1" is known to be the scalping user from previous context
    }

    const mismatch = expectedMode !== "UNKNOWN" && dbMode !== expectedMode ? "YES" : "NO";

    console.log(`${user.id.padEnd(36)} | ${user.username.padEnd(15)} | ${dbMode.padEnd(10)} | ${autoTrading} | ${mismatch}`);
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
