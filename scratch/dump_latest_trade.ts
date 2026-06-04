
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const userId = "edf316a9-46ee-4fb2-a538-ca2f65bb33f7";
  const trade = await prisma.trade.findFirst({
    where: { userId },
    orderBy: { openedAt: "desc" },
  });

  if (trade) {
    console.log(`Trade ID: ${trade.id}`);
    console.log(`Symbol: ${trade.symbol}`);
    console.log(`Audit Payload: ${JSON.stringify(trade.auditPayload, null, 2)}`);
  } else {
    console.log("No trades found.");
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
