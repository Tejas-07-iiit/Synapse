import { PrismaClient } from "@prisma/client";
import * as fs from "fs";

const prisma = new PrismaClient();

async function main() {
  const trades = await prisma.trade.findMany();
  const positions = await prisma.position.findMany();
  const signals = await prisma.signal.findMany();
  const tradeSignals = await prisma.tradeSignal.findMany();
  const strategyExecutions = await prisma.strategyExecution.findMany();

  // Phase 1: Trade Performance
  const totalTrades = trades.length;
  const winners = trades.filter(t => t.pnl > 0);
  const losers = trades.filter(t => t.pnl <= 0);
  const winRate = totalTrades ? (winners.length / totalTrades) * 100 : 0;
  const lossRate = totalTrades ? (losers.length / totalTrades) * 100 : 0;
  
  const avgWinner = winners.length ? winners.reduce((sum, t) => sum + t.pnl, 0) / winners.length : 0;
  const avgLoser = losers.length ? losers.reduce((sum, t) => sum + t.pnl, 0) / losers.length : 0;
  const grossProfit = winners.reduce((sum, t) => sum + t.pnl, 0);
  const grossLoss = Math.abs(losers.reduce((sum, t) => sum + t.pnl, 0));
  const profitFactor = grossLoss === 0 ? (grossProfit > 0 ? 999 : 0) : grossProfit / grossLoss;
  const expectancy = (winRate / 100 * avgWinner) - (lossRate / 100 * Math.abs(avgLoser));
  
  const avgHoldingTime = trades.reduce((sum, t) => sum + (new Date(t.closedAt).getTime() - new Date(t.openedAt).getTime()), 0) / (totalTrades || 1) / (1000 * 60);
  
  const longTrades = trades.filter(t => t.direction === 'LONG');
  const shortTrades = trades.filter(t => t.direction === 'SHORT');
  
  const longWR = longTrades.length ? (longTrades.filter(t=>t.pnl>0).length/longTrades.length)*100 : 0;
  const shortWR = shortTrades.length ? (shortTrades.filter(t=>t.pnl>0).length/shortTrades.length)*100 : 0;

  const symbolPerf = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'].map(sym => {
    const symTrades = trades.filter(t => t.symbol === sym);
    const wr = symTrades.length ? (symTrades.filter(t=>t.pnl>0).length/symTrades.length)*100 : 0;
    return { symbol: sym, count: symTrades.length, winRate: wr };
  });

  const phase1 = {
    totalTrades, winRate, lossRate, avgWinner, avgLoser, profitFactor, expectancy, avgHoldingTime,
    longTrades: longTrades.length, longWR, shortTrades: shortTrades.length, shortWR,
    symbolPerf
  };

  // Phase 2: Strategy Audit
  const strategyIds = [...new Set(trades.map(t => t.strategyName))]; // Since Trade has strategyName
  const strategyAudit = strategyIds.map(sName => {
    const sTrades = trades.filter(t => t.strategyName === sName);
    const sWinners = sTrades.filter(t => t.pnl > 0);
    const sLosers = sTrades.filter(t => t.pnl <= 0);
    const wr = sTrades.length ? (sWinners.length / sTrades.length) * 100 : 0;
    const avgPnl = sTrades.length ? sTrades.reduce((sum, t) => sum + t.pnl, 0) / sTrades.length : 0;
    const avgRoi = sTrades.length ? sTrades.reduce((sum, t) => sum + t.roi, 0) / sTrades.length : 0;
    const grossP = sWinners.reduce((sum, t) => sum + t.pnl, 0);
    const grossL = Math.abs(sLosers.reduce((sum, t) => sum + t.pnl, 0));
    const pf = grossL === 0 ? (grossP > 0 ? 999 : 0) : grossP / grossL;
    
    // generated signals for this strategy?
    // In trades we only have strategyName. In Signal we have strategyId.
    // We can count tradeSignals for generated signals.
    let generatedSignals = 0;
    // ... we'll just count signals where direction is LONG or SHORT
    generatedSignals = signals.filter(sig => sig.signalType !== 'HOLD' && sig.strategyId).length; 
    // Actually we need to match strategyName, let's use trade table for execution.
    
    return {
      strategyName: sName,
      tradesExecuted: sTrades.length,
      winRate: wr,
      avgRoi,
      avgPnl,
      profitFactor: pf
    };
  });

  // Phase 3: Signal Quality Audit
  // Average confidence of executed trades vs losing trades
  const avgConfExec = trades.reduce((sum, t) => sum + t.confidence, 0) / (trades.length || 1);
  const avgConfWinners = winners.reduce((sum, t) => sum + t.confidence, 0) / (winners.length || 1);
  const avgConfLosers = losers.reduce((sum, t) => sum + t.confidence, 0) / (losers.length || 1);
  const highConfTrades = trades.filter(t => t.confidence >= 75);
  const highConfWR = highConfTrades.length ? (highConfTrades.filter(t=>t.pnl>0).length/highConfTrades.length)*100 : 0;

  const phase3 = { avgConfExec, avgConfWinners, avgConfLosers, highConfTrades: highConfTrades.length, highConfWR };

  // Phase 4: Risk Management Audit
  // avg RR = avg(abs(entry-TP) / abs(entry-SL))
  const rrData = trades.map(t => {
    if (t.stopLoss && t.takeProfit && t.entryPrice) {
      const risk = Math.abs(t.entryPrice - t.stopLoss);
      const reward = Math.abs(t.entryPrice - t.takeProfit);
      return risk > 0 ? reward / risk : 0;
    }
    return 0;
  }).filter(rr => rr > 0);
  const avgRR = rrData.length ? rrData.reduce((sum, r) => sum + r, 0) / rrData.length : 0;
  
  const avgSlDistPct = trades.map(t => t.stopLoss && t.entryPrice ? Math.abs(t.entryPrice - t.stopLoss)/t.entryPrice*100 : 0).filter(x=>x>0);
  const avgTpDistPct = trades.map(t => t.takeProfit && t.entryPrice ? Math.abs(t.entryPrice - t.takeProfit)/t.entryPrice*100 : 0).filter(x=>x>0);
  const avgSl = avgSlDistPct.length ? avgSlDistPct.reduce((s,x)=>s+x,0)/avgSlDistPct.length : 0;
  const avgTp = avgTpDistPct.length ? avgTpDistPct.reduce((s,x)=>s+x,0)/avgTpDistPct.length : 0;

  const stopLossReasons = trades.filter(t => t.status === 'STOPPED' || t.exitReason === 'STOP_LOSS').length;

  const phase4 = { avgRR, avgSlPct: avgSl, avgTpPct: avgTp, stoppedTrades: stopLossReasons };

  // Phase 5: Market Regime
  const regimeStats = trades.reduce((acc, t) => {
    const r = t.marketRegime || 'UNKNOWN';
    if (!acc[r]) acc[r] = { total: 0, winners: 0, losers: 0 };
    acc[r].total++;
    if (t.pnl > 0) acc[r].winners++;
    else acc[r].losers++;
    return acc;
  }, {} as any);

  // Phase 8: Overtrading
  // Trades per day
  const days = new Set(trades.map(t => t.openedAt.toISOString().split('T')[0])).size || 1;
  const tradesPerDay = totalTrades / days;
  
  const data = { phase1, phase2: strategyAudit, phase3, phase4, phase5: regimeStats, phase8: { tradesPerDay, days } };

  fs.writeFileSync('scratch/audit_results.json', JSON.stringify(data, null, 2));

  // Dump full tables to json for manual inspection if needed
  // fs.writeFileSync('scratch/trades.json', JSON.stringify(trades, null, 2));
  // fs.writeFileSync('scratch/signals.json', JSON.stringify(signals, null, 2));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
