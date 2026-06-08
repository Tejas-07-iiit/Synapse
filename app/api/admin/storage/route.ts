import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { runRetentionPruning } from "@/src/lib/storage/pruning";
import fs from "fs";
import path from "path";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const prune = searchParams.get("prune") === "true";

    // 1. Get database size
    let dbSize = "Unknown";
    try {
      const sizeResult: any = await prisma.$queryRaw`SELECT pg_size_pretty(pg_database_size(current_database())) as size`;
      if (sizeResult && sizeResult[0] && sizeResult[0].size) {
        dbSize = sizeResult[0].size;
      }
    } catch (e) {
      console.error("Could not fetch DB size", e);
    }

    // 2. Get Top 10 Largest Tables
    let topTables: any[] = [];
    try {
      // Includes both table size and total size (with indexes)
      topTables = await prisma.$queryRaw`
        SELECT 
            relname AS table_name,
            n_live_tup AS row_count,
            pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
            pg_total_relation_size(relid) as size_bytes
        FROM pg_stat_user_tables
        ORDER BY pg_total_relation_size(relid) DESC
        LIMIT 10;
      `;
      // Convert BigInt to string for JSON serialization
      topTables = topTables.map(t => ({
        ...t,
        row_count: t.row_count ? t.row_count.toString() : "0",
        size_bytes: t.size_bytes ? t.size_bytes.toString() : "0",
      }));
    } catch (e) {
      console.error("Could not fetch top tables", e);
    }

    // 3. Perform retention pruning if requested
    let pruneResults: any = {};
    if (prune) {
      pruneResults = await runRetentionPruning();
    } else {
      // Otherwise, attempt to load the last run stats from disk
      try {
        const statsPath = path.join(process.cwd(), 'logs', 'prune_stats.json');
        if (fs.existsSync(statsPath)) {
          const statsContent = fs.readFileSync(statsPath, "utf-8");
          pruneResults = JSON.parse(statsContent);
        }
      } catch (e) {
        // Ignore file read errors
      }
    }

    // 4. Get row counts for diagnostic tables
    const counts = {
      strategyExecution: await prisma.strategyExecution.count(),
      strategyResult: await prisma.strategyResult.count(),
      tradeSignal: await prisma.tradeSignal.count(),
      signalLog: await prisma.signalLog.count(),
      indicatorSnapshot: await prisma.indicatorSnapshot.count(),
      position: await prisma.position.count(),
      trade: await prisma.trade.count(),
    };

    // Calculate Estimated Daily Growth (from the snapshot stats)
    let estimatedDailyGrowthBytes = "Unknown";
    const execStats = topTables.find(t => t.table_name === 'StrategyExecution');
    if (execStats && counts.strategyExecution > 0) {
      const avgRowSize = Number(execStats.size_bytes) / counts.strategyExecution;
      // 3 coins * 7 timeframes * 35 strategies = ~735 evaluations per minute (worst case, though some are 5m, 15m)
      // Realistic upper bound is ~20k/hr = 480k rows/day across both execution and result
      const dailyRows = 500000;
      const dailyBytes = dailyRows * avgRowSize;
      estimatedDailyGrowthBytes = (dailyBytes / (1024 * 1024)).toFixed(2) + " MB";
    }

    return NextResponse.json({
      success: true,
      dbSize,
      estimatedDailyGrowthBytes,
      counts,
      topTables,
      lastPrune: pruneResults
    });

  } catch (error: any) {
    console.error("[API-Storage] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
