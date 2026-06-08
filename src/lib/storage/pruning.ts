import prisma from "@/lib/prisma";
import fs from "fs";
import path from "path";

export async function runRetentionPruning() {
  console.log("[StorageManager] Starting retention pruning...");
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const execDel = await prisma.strategyExecution.deleteMany({ where: { timestamp: { lt: sevenDaysAgo } } });
    const resDel = await prisma.strategyResult.deleteMany({ where: { timestamp: { lt: sevenDaysAgo } } });
    const indDel = await prisma.indicatorSnapshot.deleteMany({ where: { createdAt: { lt: sevenDaysAgo } } });
    const tsDel = await prisma.tradeSignal.deleteMany({ where: { createdAt: { lt: thirtyDaysAgo } } });
    const slDel = await prisma.signalLog.deleteMany({ where: { createdAt: { lt: thirtyDaysAgo } } });

    console.log(`[StorageManager] Pruned rows - StrategyExecution: ${execDel.count}, StrategyResult: ${resDel.count}, IndicatorSnapshot: ${indDel.count}, TradeSignal: ${tsDel.count}, SignalLog: ${slDel.count}`);

    // Reclaim disk space natively in Postgres via VACUUM
    const deletedCount = execDel.count + resDel.count + indDel.count + tsDel.count + slDel.count;
    if (deletedCount > 0) {
      console.log("[StorageManager] Running standard VACUUM on pruned tables to reclaim space for reuse...");
      // Wrap in individual try-catch blocks to prevent one table's vacuum error from halting others
      try { await prisma.$executeRawUnsafe('VACUUM synapse."StrategyExecution";'); } catch(e) { console.error("[VACUUM] Error on StrategyExecution:", e); }
      try { await prisma.$executeRawUnsafe('VACUUM synapse."StrategyResult";'); } catch(e) { console.error("[VACUUM] Error on StrategyResult:", e); }
      try { await prisma.$executeRawUnsafe('VACUUM synapse."IndicatorSnapshot";'); } catch(e) { console.error("[VACUUM] Error on IndicatorSnapshot:", e); }
      try { await prisma.$executeRawUnsafe('VACUUM synapse."TradeSignal";'); } catch(e) { console.error("[VACUUM] Error on TradeSignal:", e); }
      try { await prisma.$executeRawUnsafe('VACUUM synapse."SignalLog";'); } catch(e) { console.error("[VACUUM] Error on SignalLog:", e); }
      console.log("[StorageManager] VACUUM completed.");
    }

    // Save pruning metadata for diagnostic endpoints
    const stats = {
      lastPruneTimestamp: now.toISOString(),
      rowsDeleted: {
        strategyExecution: execDel.count,
        strategyResult: resDel.count,
        indicatorSnapshot: indDel.count,
        tradeSignal: tsDel.count,
        signalLog: slDel.count,
        total: deletedCount
      }
    };
    
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    fs.writeFileSync(path.join(logsDir, 'prune_stats.json'), JSON.stringify(stats, null, 2));

    return stats;
  } catch (err) {
    console.error("[StorageManager] Retention pruning failed:", err);
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
