import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function runAudit() {
  console.log('Starting Scalping Strategy Audit...');

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // 1. Identify Strategies (Manual mapping based on strategy engine files and typical names)
  // To be accurate with the system, let's pull all strategies from the registry if possible,
  // but we can also just infer from DB if they have been active, or use a hardcoded list from previous context.
  
  // Let's get distinct strategies from signals
  const allStrategies = await prisma.tradeSignal.findMany({
    select: { strategyId: true },
    distinct: ['strategyId'],
  });

  const strategyIds = allStrategies.map(s => s.strategyId);

  // Known scalping and others from previous grep:
  const scalpingIds = [
    'bollinger-breakout', 'bollinger-reversion', 'donchian-breakout', 'ema-crossover',
    'grid', 'macd-momentum', 'mean-reversion', 'momentum', 'parabolic-rsi',
    'rally-base-drop', 'range-breakout-high', 'residual-momentum', 'rsi-reversal',
    'short-term-reversal', 'sr-sweep', 'wavetrend'
  ];
  
  const strategyInfo: Record<string, any> = {};
  for (const id of scalpingIds) {
      strategyInfo[id] = {
          name: id,
          category: 'Scalping',
          supportedRegimes: ['Various'],
          expectedHoldingPeriod: '5m-45m'
      };
  }

  // Fallbacks for others
  for (const id of strategyIds) {
      if (!strategyInfo[id]) {
          strategyInfo[id] = {
              name: id,
              category: 'Other',
              supportedRegimes: ['Various'],
              expectedHoldingPeriod: 'Unknown'
          };
      }
  }

  // We focus on scalpingIds for detailed stats
  const activeScalpingIds = strategyIds.filter(id => scalpingIds.includes(id));

  // Phase 2: Signal Generation Audit
  const signals = await prisma.tradeSignal.findMany({
    where: {
      strategyId: { in: activeScalpingIds },
      timestamp: { gte: sevenDaysAgo }
    }
  });

  const signalStats: Record<string, any> = {};
  activeScalpingIds.forEach(id => {
      signalStats[id] = {
          generated: 0, rejected: 0, executed: 0,
          reasons: {
              lowConfidence: 0, cooldown: 0, regimeMismatch: 0, maxPositions: 0,
              quarantined: 0, conflict: 0, risk: 0, other: 0
          },
          avgConfidence: 0, confCount: 0,
          confUnder50: 0, conf50to70: 0, confOver70: 0,
          blockedByRegime: 0
      };
  });

  signals.forEach(s => {
      const stats = signalStats[s.strategyId];
      if (!stats) return;

      stats.generated++;
      if (s.confidence !== undefined) {
          stats.avgConfidence += s.confidence;
          stats.confCount++;
          if (s.confidence < 50) stats.confUnder50++;
          else if (s.confidence <= 70) stats.conf50to70++;
          else stats.confOver70++;
      }

      if (s.blocked) {
          stats.rejected++;
          const reason = (s.blockReason || '').toLowerCase();
          if (reason.includes('confidence')) stats.reasons.lowConfidence++;
          else if (reason.includes('cooldown')) stats.reasons.cooldown++;
          else if (reason.includes('regime')) { stats.reasons.regimeMismatch++; stats.blockedByRegime++; }
          else if (reason.includes('max open')) stats.reasons.maxPositions++;
          else if (reason.includes('quarantine')) stats.reasons.quarantined++;
          else if (reason.includes('exists')) stats.reasons.conflict++;
          else if (reason.includes('risk') || reason.includes('margin') || reason.includes('correlation')) stats.reasons.risk++;
          else stats.reasons.other++;
      } else {
          stats.executed++;
      }
  });

  // Phase 3 & 4: Profitability and Trade Quality
  const trades = await prisma.trade.findMany({
    where: {
      strategyId: { in: activeScalpingIds },
    }
  });

  const tradeStats: Record<string, any> = {};
  activeScalpingIds.forEach(id => {
      tradeStats[id] = {
          total: 0, wins: 0, losses: 0,
          grossProfit: 0, grossLoss: 0, netProfit: 0,
          roiSum: 0, durationSum: 0,
          tpHit: 0, slHit: 0, manual: 0, timeout: 0,
          rrSum: 0, rrCount: 0
      };
  });

  trades.forEach(t => {
      if (!t.closedAt || !t.strategyId) return;
      const stats = tradeStats[t.strategyId];
      if (!stats) return;

      stats.total++;
      if (t.pnl > 0) {
          stats.wins++;
          stats.grossProfit += t.pnl;
      } else {
          stats.losses++;
          stats.grossLoss += Math.abs(t.pnl);
      }
      stats.netProfit += t.pnl;
      
      const roi = t.entryPrice ? (t.pnl / t.entryPrice) * 100 : 0; // rough ROI
      stats.roiSum += roi;

      if (t.closedAt && t.openedAt) {
          stats.durationSum += (new Date(t.closedAt).getTime() - new Date(t.openedAt).getTime()) / 60000; // in minutes
      }

      if (t.status === 'TP HIT' || t.exitReason === 'TAKE_PROFIT') stats.tpHit++;
      else if (t.status === 'STOPPED' || t.exitReason === 'STOP_LOSS') stats.slHit++;
      else if (t.exitReason === 'TIMEOUT') stats.timeout++;
      else stats.manual++;

      if (t.entryPrice && t.stopLoss && t.takeProfit) {
          const risk = Math.abs(t.entryPrice - t.stopLoss);
          const reward = Math.abs(t.takeProfit - t.entryPrice);
          if (risk > 0) {
              stats.rrSum += (reward / risk);
              stats.rrCount++;
          }
      }
  });

  // Overtrading (Rough heuristic: count signals per symbol per day)
  const overtrading: Record<string, any> = {};
  activeScalpingIds.forEach(id => {
      overtrading[id] = { duplicateSignals: 0, reEntries: 0, riskScore: 0 };
      // Check signals close to each other on same symbol
      const stratSignals = signals.filter(s => s.strategyId === id).sort((a,b) => a.timestamp.getTime() - b.timestamp.getTime());
      let duplicates = 0;
      for (let i = 1; i < stratSignals.length; i++) {
          if (stratSignals[i].symbol === stratSignals[i-1].symbol && 
              (stratSignals[i].timestamp.getTime() - stratSignals[i-1].timestamp.getTime()) < 30 * 60000) { // within 30 mins
              duplicates++;
          }
      }
      overtrading[id].duplicateSignals = duplicates;
      overtrading[id].riskScore = duplicates > 20 ? 'HIGH' : (duplicates > 5 ? 'MEDIUM' : 'LOW');
  });

  // Execution Pipeline global stats
  const totalGenerated = signals.length;
  const passedRisk = signals.filter(s => !s.blocked).length;
  const executed = passedRisk; // Simplifying assumption based on available db fields

  // Build Markdown
  let md = `# Synapse Scalping Strategy Audit\n\n`;

  md += `## Phase 1 — Identify Scalping Strategies\n\n`;
  activeScalpingIds.forEach(id => {
      const info = strategyInfo[id];
      md += `* **Strategy Name:** ${info.name}\n`;
      md += `* **Strategy ID:** ${id}\n`;
      md += `* **Category:** ${info.category}\n`;
      md += `* **Expected Holding Period:** ${info.expectedHoldingPeriod}\n\n`;
  });

  md += `## Phase 2 — Signal Generation Audit (Last 7 Days)\n\n`;
  activeScalpingIds.forEach(id => {
      const stats = signalStats[id];
      md += `### ${id}\n`;
      md += `* Signals Generated: ${stats.generated}\n`;
      md += `* Signals Rejected: ${stats.rejected}\n`;
      md += `* Signals Executed: ${stats.executed}\n`;
      md += `* Execution Rate: ${stats.generated > 0 ? ((stats.executed/stats.generated)*100).toFixed(1) : 0}%\n\n`;
      if (stats.rejected > 0) {
          md += `**Rejection Breakdown:**\n`;
          md += `- Low Confidence: ${stats.reasons.lowConfidence}\n`;
          md += `- Cooldown Block: ${stats.reasons.cooldown}\n`;
          md += `- Regime Mismatch: ${stats.reasons.regimeMismatch}\n`;
          md += `- Max Positions Reached: ${stats.reasons.maxPositions}\n`;
          md += `- Quarantined: ${stats.reasons.quarantined}\n`;
          md += `- Existing Position Conflict: ${stats.reasons.conflict}\n`;
          md += `- Risk/Margin: ${stats.reasons.risk}\n`;
          md += `- Other: ${stats.reasons.other}\n\n`;
      }
  });

  md += `## Phase 3 — Profitability Audit\n\n`;
  const profitableStrats = activeScalpingIds.map(id => {
      const stats = tradeStats[id];
      const winRate = stats.total > 0 ? (stats.wins / stats.total) * 100 : 0;
      const profitFactor = stats.grossLoss > 0 ? stats.grossProfit / stats.grossLoss : (stats.grossProfit > 0 ? 999 : 0);
      return { id, stats, winRate, profitFactor };
  }).sort((a, b) => b.stats.netProfit - a.stats.netProfit);

  profitableStrats.forEach(({id, stats, winRate, profitFactor}) => {
      md += `### ${id}\n`;
      md += `* Total Trades: ${stats.total}\n`;
      md += `* Wins: ${stats.wins}\n`;
      md += `* Losses: ${stats.losses}\n`;
      md += `* Win Rate: ${winRate.toFixed(1)}%\n`;
      md += `* Average ROI: ${stats.total > 0 ? (stats.roiSum / stats.total).toFixed(2) : 0}%\n`;
      md += `* Net Profit: $${stats.netProfit.toFixed(2)}\n`;
      md += `* Gross Profit: $${stats.grossProfit.toFixed(2)}\n`;
      md += `* Gross Loss: $${stats.grossLoss.toFixed(2)}\n`;
      md += `* Profit Factor: ${profitFactor.toFixed(2)}\n`;
      md += `* Avg Trade Duration: ${stats.total > 0 ? (stats.durationSum / stats.total).toFixed(0) : 0} mins\n\n`;
  });

  md += `## Phase 4 — Trade Quality Analysis\n\n`;
  activeScalpingIds.forEach(id => {
      const stats = tradeStats[id];
      md += `### ${id}\n`;
      md += `* TP Hit %: ${stats.total > 0 ? ((stats.tpHit/stats.total)*100).toFixed(1) : 0}%\n`;
      md += `* SL Hit %: ${stats.total > 0 ? ((stats.slHit/stats.total)*100).toFixed(1) : 0}%\n`;
      md += `* Manual/Timeout Close %: ${stats.total > 0 ? (((stats.manual + stats.timeout)/stats.total)*100).toFixed(1) : 0}%\n`;
      md += `* Average RR Achieved: ${stats.rrCount > 0 ? (stats.rrSum / stats.rrCount).toFixed(2) : 'N/A'}\n\n`;
  });

  md += `## Phase 5 — Overtrading Detection\n\n`;
  activeScalpingIds.forEach(id => {
      const ot = overtrading[id];
      md += `### ${id}\n`;
      md += `* Duplicate Signals (within 30m): ${ot.duplicateSignals}\n`;
      md += `* Overtrading Risk Score: ${ot.riskScore}\n\n`;
  });

  md += `## Phase 6 — Confidence Score Audit\n\n`;
  activeScalpingIds.forEach(id => {
      const stats = signalStats[id];
      const avg = stats.confCount > 0 ? stats.avgConfidence / stats.confCount : 0;
      md += `### ${id}\n`;
      md += `* Average Confidence Score: ${avg.toFixed(1)}\n`;
      md += `* Confidence < 50: ${stats.confUnder50}\n`;
      md += `* Confidence 50-70: ${stats.conf50to70}\n`;
      md += `* Confidence > 70: ${stats.confOver70}\n\n`;
  });

  md += `## Phase 7 — Regime Compatibility Audit\n\n`;
  activeScalpingIds.forEach(id => {
      const stats = signalStats[id];
      md += `### ${id}\n`;
      md += `* Signals Blocked Due To Regime: ${stats.blockedByRegime}\n\n`;
  });

  md += `## Phase 8 — Execution Pipeline Audit (Scalping Total)\n\n`;
  md += `* Signal Generated: ${totalGenerated}\n`;
  md += `* Passed Risk & Executed: ${passedRisk}\n`;
  md += `* Lost in pipeline: ${totalGenerated - passedRisk}\n\n`;

  md += `## Phase 9 — Strategy Ranking & Recommendations\n\n`;
  md += `| Rank | Strategy | Net Profit | Profit Factor | Win Rate | Trades | Classification |\n`;
  md += `|---|---|---|---|---|---|---|\n`;
  profitableStrats.forEach((item, index) => {
      let classification = 'KEEP';
      if (item.stats.netProfit < 0) classification = 'DISABLE';
      else if (item.stats.total < 5) classification = 'MONITOR';
      else if (overtrading[item.id].riskScore === 'HIGH') classification = 'QUARANTINE';

      md += `| ${index + 1} | ${item.id} | $${item.stats.netProfit.toFixed(2)} | ${item.profitFactor.toFixed(2)} | ${item.winRate.toFixed(1)}% | ${item.stats.total} | **${classification}** |\n`;
  });

  fs.writeFileSync(path.join(__dirname, '../docs/SCALPING_STRATEGY_AUDIT.md'), md);
  console.log('Audit completed. Saved to docs/SCALPING_STRATEGY_AUDIT.md');
}

runAudit().catch(console.error).finally(() => prisma.$disconnect());
