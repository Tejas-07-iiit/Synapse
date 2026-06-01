import prisma from "../lib/prisma.js";

async function main() {
  const wallet = await prisma.wallet.findFirst();
  const trades = await prisma.trade.findMany({
    orderBy: { closedAt: "asc" }
  });
  const openPositions = await prisma.position.findMany({
    where: { status: "OPEN" }
  });

  const startingCapital = wallet ? wallet.totalDeposited : 10000.0;
  const realizedPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
  const unrealizedPnL = openPositions.reduce((sum, p) => sum + p.pnl, 0);
  const currentEquity = (wallet ? wallet.balance : startingCapital) + unrealizedPnL;

  console.log("Starting Capital:", startingCapital);
  console.log("Realized PnL:", realizedPnL);
  console.log("Unrealized PnL:", unrealizedPnL);
  console.log("Current Equity:", currentEquity);

  console.log("\n--- Equity Curve Points ---");
  let runningEquity = startingCapital;
  const curve = [];
  if (trades.length > 0) {
    console.log(`Initial Point (Opened first trade): ${trades[0].openedAt.toISOString()} -> Equity: ${startingCapital}`);
    curve.push({ timestamp: trades[0].openedAt.toISOString(), equity: startingCapital });
    
    trades.forEach((t) => {
      runningEquity += t.pnl;
      console.log(`Trade Closed: ${t.closedAt.toISOString()} -> PnL: ${t.pnl} -> Equity: ${runningEquity}`);
      curve.push({ timestamp: t.closedAt.toISOString(), equity: runningEquity });
    });
  }

  // Drawdown
  let peak = startingCapital;
  let maxDD = 0;
  let currentVal = startingCapital;

  trades.forEach((t) => {
    currentVal += t.pnl;
    if (currentVal > peak) {
      peak = currentVal;
    }
    const dd = ((peak - currentVal) / peak) * 100;
    if (dd > maxDD) {
      maxDD = dd;
    }
  });

  const currentPeak = Math.max(peak, currentEquity);
  const currentDD = ((currentPeak - currentEquity) / currentPeak) * 100;
  
  let recovery = 100;
  if (maxDD > 0) {
    const trough = peak * (1 - maxDD / 100);
    recovery = ((currentEquity - trough) / (peak - trough)) * 100;
  }

  console.log("\n--- Drawdown Analytics ---");
  console.log("Max Drawdown (%):", -maxDD);
  console.log("Current Drawdown (%):", -currentDD);
  console.log("Recovery (%):", Math.max(0, Math.min(100, recovery)));
}

main().catch(console.error);
