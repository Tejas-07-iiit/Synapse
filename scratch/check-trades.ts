import prisma from "../lib/prisma.js";

async function main() {
  const trades = await prisma.trade.findMany({
    orderBy: { closedAt: "asc" }
  });
  console.log("TOTAL TRADES IN DB:", trades.length);
  trades.forEach(t => {
    console.log(`Trade ID: ${t.id}, Symbol: ${t.symbol}, Strategy: ${t.strategyName}, PnL: ${t.pnl}, Opened: ${t.openedAt.toISOString()}, Closed: ${t.closedAt.toISOString()}`);
  });

  const wallets = await prisma.wallet.findMany();
  console.log("WALLETS IN DB:", wallets);

  const positions = await prisma.position.findMany();
  console.log("TOTAL POSITIONS IN DB:", positions.length);
  positions.forEach(p => {
    console.log(`Position ID: ${p.id}, Symbol: ${p.symbol}, Status: ${p.status}, PnL: ${p.pnl}, Opened: ${p.openedAt.toISOString()}`);
  });
}

main().catch(console.error);
