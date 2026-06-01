import prisma from "../../../lib/prisma";

export class PerformanceWeightingEngine {
  private static cachedScores: Map<string, number> = new Map(); // strategyId -> score
  private static isUpdating = false;

  /**
   * Calculates performance scores for all strategies.
   * Can be triggered on startup and dynamically on trade closes.
   */
  public static async updatePerformanceScores(): Promise<void> {
    if (this.isUpdating) return;
    this.isUpdating = true;

    try {
      console.log("[PerformanceWeight] Recalculating strategy performance weights from DB...");
      
      // Query completed trades
      const trades = await prisma.trade.findMany({
        where: {
          executionType: "PAPER", // or live
        },
        orderBy: {
          closedAt: "desc",
        },
      });

      // Group trades by strategy ID
      const tradesByStrategy: Record<string, typeof trades> = {};
      for (const t of trades) {
        if (!t.strategyId) continue;
        if (!tradesByStrategy[t.strategyId]) {
          tradesByStrategy[t.strategyId] = [];
        }
        tradesByStrategy[t.strategyId].push(t);
      }

      for (const [strategyId, strategyTrades] of Object.entries(tradesByStrategy)) {
        const totalTrades = strategyTrades.length;
        if (totalTrades === 0) {
          this.cachedScores.set(strategyId, 70); // Baseline
          continue;
        }

        // 1. Win Rate (40%)
        const wins = strategyTrades.filter((t) => t.pnl > 0).length;
        const winRate = wins / totalTrades; // 0 to 1
        const scoreWR = winRate * 100;

        // 2. Profit Factor (30%)
        const grossProfit = strategyTrades.filter((t) => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0);
        const grossLoss = strategyTrades.filter((t) => t.pnl <= 0).reduce((sum, t) => sum + Math.abs(t.pnl), 0);
        const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss) : (grossProfit > 0 ? 3.0 : 1.0);
        // Clamp profit factor to max 3.0
        const clampedPF = Math.min(3.0, Math.max(0, profitFactor));
        const scorePF = (clampedPF / 3.0) * 100;

        // 3. Recent Performance (last 5 trades) (20%)
        const recentTrades = strategyTrades.slice(0, 5);
        const recentWins = recentTrades.filter((t) => t.pnl > 0).length;
        const recentTotal = recentTrades.length;
        const recentWinRate = recentTotal > 0 ? recentWins / recentTotal : 0.5;
        const scoreRP = recentWinRate * 100;

        // 4. Drawdown (10%)
        // Calculate cumulative PnL to find peak-to-trough drawdown
        let balance = 10000;
        let peak = 10000;
        let maxDdPct = 0;

        // Run trades chronological (from oldest to newest)
        const chronTrades = [...strategyTrades].reverse();
        for (const t of chronTrades) {
          balance += t.pnl;
          if (balance > peak) {
            peak = balance;
          }
          const dd = peak > 0 ? ((peak - balance) / peak) * 100 : 0;
          if (dd > maxDdPct) {
            maxDdPct = dd;
          }
        }
        // Score DD: 100 is 0% drawdown, 0 is 20%+ drawdown
        const scoreDD = Math.max(0, 100 - maxDdPct * 5);

        // Weighted final score
        const finalScore = scoreWR * 0.4 + scorePF * 0.3 + scoreRP * 0.2 + scoreDD * 0.1;
        const finalScoreRounded = Math.min(100, Math.max(0, Math.round(finalScore)));
        this.cachedScores.set(strategyId, finalScoreRounded);
        
        console.log(`[PerformanceWeight] Strategy "${strategyId}": WR: ${(winRate * 100).toFixed(1)}% | PF: ${profitFactor.toFixed(2)} | MaxDD: ${maxDdPct.toFixed(1)}% | Score: ${finalScoreRounded}`);
      }
    } catch (err) {
      console.error("[PerformanceWeight] Failed to update performance scores:", err);
    } finally {
      this.isUpdating = false;
    }
  }

  /**
   * Retrieves the current boost/penalty score for a strategy.
   * Boost ranges from -35.0 (for score 0) to +15.0 (for score 100).
   * Default baseline is 0 (for score 70).
   */
  public static getStrategyBoost(strategyId: string): number {
    const score = this.cachedScores.get(strategyId) ?? 70; // Default baseline score
    return (score - 70) / 2; // Maps 70 -> 0, 100 -> +15, 0 -> -35
  }

  public static getStrategyScore(strategyId: string): number {
    return this.cachedScores.get(strategyId) ?? 70;
  }
}
