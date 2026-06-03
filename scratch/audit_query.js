const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const trades = await prisma.trade.findMany();

  const strategies = [...new Set(trades.map(t => t.strategyName))];

  console.log("FEE-ADJUSTED EXPECTANCY PER STRATEGY:");
  
  for (const strat of strategies) {
    const stratTrades = trades.filter(t => t.strategyName === strat);
    const total = stratTrades.length;
    
    const wins = stratTrades.filter(t => t.netPnl > 0);
    const losses = stratTrades.filter(t => t.netPnl <= 0);
    
    const winRate = total > 0 ? wins.length / total : 0;
    const lossRate = total > 0 ? losses.length / total : 0;
    
    const avgWinner = wins.length > 0 
      ? wins.reduce((sum, t) => sum + (t.grossPnl || t.pnl), 0) / wins.length 
      : 0;
      
    const avgLoser = losses.length > 0 
      ? losses.reduce((sum, t) => sum + (t.grossPnl || t.pnl), 0) / losses.length 
      : 0;
      
    const avgFees = stratTrades.reduce((sum, t) => sum + (t.totalFees || (t.entryFee + t.exitFee)), 0) / total;
    
    const netExpectancy = (winRate * avgWinner) + (lossRate * avgLoser) - avgFees;
    
    console.log(`\nStrategy: ${strat}`);
    console.log(`  Total Trades: ${total}`);
    console.log(`  Win Rate: ${(winRate * 100).toFixed(1)}% | Loss Rate: ${(lossRate * 100).toFixed(1)}%`);
    console.log(`  Average Winner (Gross): $${avgWinner.toFixed(4)}`);
    console.log(`  Average Loser (Gross): $${avgLoser.toFixed(4)}`);
    console.log(`  Average Fees: $${avgFees.toFixed(4)}`);
    console.log(`  Net Expectancy (Average Net PnL): $${netExpectancy.toFixed(4)}`);
    console.log(`  Profitable After Fees: ${netExpectancy > 0 ? "YES" : "NO"}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
