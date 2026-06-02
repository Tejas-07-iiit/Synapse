import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== ALL POSITIONS ===");
  const positions = await prisma.position.findMany();
  for (const p of positions) {
    console.log(`Position: ID=${p.id} | Symbol=${p.symbol} | Direction=${p.direction} | Status=${p.status} | CreatedAt=${p.openedAt.toISOString()} | ClosedAt=${p.closedAt?.toISOString()} | UserID=${p.userId} | StrategyId=${p.strategyId}`);
  }

  console.log("=== ALL TRADES ===");
  const trades = await prisma.trade.findMany();
  for (const t of trades) {
    console.log(`Trade: ID=${t.id} | Symbol=${t.symbol} | Direction=${t.direction} | Status=${t.status} | OpenedAt=${t.openedAt.toISOString()} | ClosedAt=${t.closedAt.toISOString()} | UserID=${t.userId} | PositionId=${t.positionId}`);
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
