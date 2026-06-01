import prisma from "../../../lib/prisma";

export interface StrategyStats {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number; // 0 to 1
  netPnL: number;
  averageRoi: number;
  profitFactor: number;
  boostOrPenalty: number;
  isQuarantined: boolean;
}

export class PerformanceWeightingEngine {
  private static strategyStatsMap: Map<string, StrategyStats> = new Map();
  private static isUpdating = false;

  /**
   * Calculates performance scores and detailed metrics for all strategies from DB.
   */
  public static async updatePerformanceScores(): Promise<void> {
    if (this.isUpdating) return;
    this.isUpdating = true;

    try {
      console.log("[PerformanceWeight] Recalculating strategy performance weights from DB...");
      
      const trades = await prisma.trade.findMany({
        where: {
          executionType: "PAPER",
        },
        orderBy: {
          closedAt: "desc",
        },
      });

      const tradesByStrategy: Record<string, typeof trades> = {};
      for (const t of trades) {
        if (!t.strategyId) continue;
        if (!tradesByStrategy[t.strategyId]) {
          tradesByStrategy[t.strategyId] = [];
        }
        tradesByStrategy[t.strategyId].push(t);
      }

      // Clear previous map
      this.strategyStatsMap.clear();

      for (const [strategyId, strategyTrades] of Object.entries(tradesByStrategy)) {
        const totalTrades = strategyTrades.length;
        if (totalTrades === 0) {
          continue;
        }

        const wins = strategyTrades.filter((t) => t.pnl > 0).length;
        const losses = totalTrades - wins;
        const winRate = wins / totalTrades;
        const netPnL = strategyTrades.reduce((sum, t) => sum + t.pnl, 0);
        const averageRoi = strategyTrades.reduce((sum, t) => sum + t.roi, 0) / totalTrades;

        const grossProfit = strategyTrades.filter((t) => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0);
        const grossLoss = strategyTrades.filter((t) => t.pnl <= 0).reduce((sum, t) => sum + Math.abs(t.pnl), 0);
        const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss) : (grossProfit > 0 ? 3.0 : 1.0);

        // Performance Penalty / Bonus calculation
        let boostOrPenalty = 0;
        const wrPct = winRate * 100;
        if (wrPct < 40) {
          // Scales from -10 (at 40% WR) to -35 (at 0% WR)
          boostOrPenalty = -10 - ((40 - wrPct) / 40) * 25;
        } else if (wrPct > 60) {
          // Scales from +5 (at 60% WR) to +20 (at 100% WR)
          boostOrPenalty = 5 + ((wrPct - 60) / 40) * 15;
        }

        // Quarantine check: last 50 trades and WR < 30% OR net PnL is deeply negative (< -200 USDT)
        // For last 50 trades: check if totalTrades >= 50 and win rate of the last 50 trades is < 30%
        let last50WinRate = winRate;
        if (totalTrades >= 50) {
          const last50Trades = strategyTrades.slice(0, 50);
          const last50Wins = last50Trades.filter((t) => t.pnl > 0).length;
          last50WinRate = last50Wins / 50;
        }
        const isQuarantined = (totalTrades >= 50 && last50WinRate < 0.30) || (netPnL < -200);

        this.strategyStatsMap.set(strategyId, {
          totalTrades,
          wins,
          losses,
          winRate,
          netPnL,
          averageRoi,
          profitFactor,
          boostOrPenalty,
          isQuarantined,
        });
        
        console.log(`[PerformanceWeight] Strategy "${strategyId}": Total Trades: ${totalTrades} | WR: ${(winRate * 100).toFixed(1)}% | NetPnL: $${netPnL.toFixed(2)} | Boost/Penalty: ${boostOrPenalty.toFixed(1)} | Quarantined: ${isQuarantined}`);
      }
    } catch (err) {
      console.error("[PerformanceWeight] Failed to update performance scores:", err);
    } finally {
      this.isUpdating = false;
    }
  }

  /**
   * Retrieves the current boost/penalty score for a strategy.
   */
  public static getStrategyBoost(strategyId: string): number {
    const stats = this.strategyStatsMap.get(strategyId);
    return stats ? Math.round(stats.boostOrPenalty) : 0;
  }

  /**
   * Check if a strategy is quarantined.
   */
  public static isQuarantined(strategyId: string): boolean {
    const stats = this.strategyStatsMap.get(strategyId);
    return stats ? stats.isQuarantined : false;
  }

  /**
   * Gets central strategy performance metrics.
   */
  public static getStats(strategyId: string): StrategyStats | null {
    return this.strategyStatsMap.get(strategyId) || null;
  }
}
