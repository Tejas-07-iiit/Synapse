import { StrategySignal, ConsensusCategory } from "../types";

// ─── Category Consensus Thresholds ───
export interface CategoryThreshold {
  minConsensusPct: number;    // Minimum percentage of strategies agreeing on direction
  minAvgConfidence: number;   // Minimum average confidence of agreeing strategies
}

const CATEGORY_THRESHOLDS: Record<ConsensusCategory, CategoryThreshold> = {
  [ConsensusCategory.SCALPING]:   { minConsensusPct: 60, minAvgConfidence: 65 },
  [ConsensusCategory.INTRADAY]:   { minConsensusPct: 45, minAvgConfidence: 60 },
  [ConsensusCategory.SWING]:      { minConsensusPct: 35, minAvgConfidence: 55 },
  [ConsensusCategory.DEFENSIVE]:  { minConsensusPct: 30, minAvgConfidence: 50 },
};

// ─── Consensus Result Types ───
export interface CategoryConsensus {
  category: ConsensusCategory;
  longCount: number;
  shortCount: number;
  holdCount: number;
  totalCount: number;
  winningDirection: "LONG" | "SHORT" | "HOLD";
  consensusPct: number;
  avgConfidence: number;
  approved: boolean;
  rejectionReason?: string;
  winningSignals: StrategySignal[];
}

export interface ConsensusResult {
  categoryResults: CategoryConsensus[];
  approvedCategories: CategoryConsensus[];
  bestCategory: CategoryConsensus | null;
  bestSignal: StrategySignal | null;
  feeRejected: boolean;
  feeRejectionReason?: string;
}

// ─── Fee-Aware Profitability Constants ───
const TAKER_FEE_RATE = 0.001; // 0.1% Binance taker fee
const MIN_PROFIT_FEE_MULTIPLE = 2; // Gross profit must exceed 2× total fees

// ─── User Mode → Allowed Categories Mapping ───
export const USER_MODE_CATEGORY_MAP: Record<string, ConsensusCategory[]> = {
  "SCALPING":  [ConsensusCategory.SCALPING, ConsensusCategory.DEFENSIVE],
  "INTRADAY":  [ConsensusCategory.SCALPING, ConsensusCategory.INTRADAY, ConsensusCategory.DEFENSIVE],
  // Future: "SWING" → [SCALPING, INTRADAY, SWING, DEFENSIVE]
};

export class ConsensusEngine {

  /**
   * Evaluate all signals for a given symbol and determine consensus across categories.
   * Returns the best approved category and signal, or null if no consensus is reached.
   */
  public static evaluate(
    signals: StrategySignal[],
    regime: string
  ): ConsensusResult {
    // 1. Group signals by consensus category
    const categoryGroups = new Map<ConsensusCategory, StrategySignal[]>();

    for (const sig of signals) {
      if (sig.signal === "HOLD" || !sig.consensusCategory) continue;

      const cat = sig.consensusCategory as ConsensusCategory;
      if (!Object.values(ConsensusCategory).includes(cat)) continue;

      if (!categoryGroups.has(cat)) {
        categoryGroups.set(cat, []);
      }
      categoryGroups.get(cat)!.push(sig);
    }

    // 2. Calculate consensus for each category
    const categoryResults: CategoryConsensus[] = [];

    for (const [category, catSignals] of categoryGroups.entries()) {
      const result = this.calculateCategoryConsensus(category, catSignals);
      categoryResults.push(result);

      // Log consensus metrics
      this.logConsensus(result);
    }

    // 3. Filter to approved categories
    const approvedCategories = categoryResults.filter(c => c.approved);

    // 4. Pick the best approved category
    // Priority: highest (consensusPct × avgConfidence) product
    let bestCategory: CategoryConsensus | null = null;
    if (approvedCategories.length > 0) {
      approvedCategories.sort((a, b) => {
        const scoreA = a.consensusPct * a.avgConfidence;
        const scoreB = b.consensusPct * b.avgConfidence;
        return scoreB - scoreA;
      });
      bestCategory = approvedCategories[0];
    }

    // 5. Pick the best signal from the winning category
    let bestSignal: StrategySignal | null = null;
    let feeRejected = false;
    let feeRejectionReason: string | undefined;

    if (bestCategory && bestCategory.winningSignals.length > 0) {
      // Sort winning signals by confidence descending, then by finalScore if available
      const sorted = [...bestCategory.winningSignals].sort((a, b) => {
        const scoreA = (a as any).finalScore ?? a.confidence;
        const scoreB = (b as any).finalScore ?? b.confidence;
        return scoreB - scoreA;
      });

      bestSignal = sorted[0];

      // 6. Fee-Aware Profitability Check (Scalping only)
      if (bestCategory.category === ConsensusCategory.SCALPING && bestSignal) {
        const feeCheck = this.checkFeeEfficiency(bestSignal);
        if (!feeCheck.passed) {
          feeRejected = true;
          feeRejectionReason = feeCheck.reason;
          console.log(`[CONSENSUS_REJECTED] FEE_INEFFICIENT_SCALP: ${feeCheck.reason}`);
          bestSignal = null;
          bestCategory = null;
        }
      }
    }

    // Log approved/rejected
    if (bestCategory && bestSignal) {
      console.log(
        `[CONSENSUS_APPROVED] Category: ${bestCategory.category} | ` +
        `Direction: ${bestCategory.winningDirection} | ` +
        `Consensus: ${bestCategory.consensusPct.toFixed(1)}% | ` +
        `Avg Confidence: ${bestCategory.avgConfidence.toFixed(1)} | ` +
        `Selected Strategy: ${bestSignal.strategyName} (${bestSignal.strategyId})`
      );
    } else if (!feeRejected && categoryResults.length > 0) {
      const reasons = categoryResults
        .filter(c => !c.approved)
        .map(c => `${c.category}: ${c.rejectionReason}`)
        .join("; ");
      console.log(`[CONSENSUS_REJECTED] No category reached consensus. ${reasons}`);
    }

    return {
      categoryResults,
      approvedCategories,
      bestCategory,
      bestSignal,
      feeRejected,
      feeRejectionReason,
    };
  }

  /**
   * Calculate consensus metrics for a single category.
   */
  private static calculateCategoryConsensus(
    category: ConsensusCategory,
    signals: StrategySignal[]
  ): CategoryConsensus {
    let longCount = 0;
    let shortCount = 0;
    let holdCount = 0;
    const longSignals: StrategySignal[] = [];
    const shortSignals: StrategySignal[] = [];

    for (const sig of signals) {
      if (sig.signal === "LONG") {
        longCount++;
        longSignals.push(sig);
      } else if (sig.signal === "SHORT") {
        shortCount++;
        shortSignals.push(sig);
      } else {
        holdCount++;
      }
    }

    const totalCount = signals.length;
    const threshold = CATEGORY_THRESHOLDS[category];

    // Determine winning direction
    let winningDirection: "LONG" | "SHORT" | "HOLD" = "HOLD";
    let winningCount = 0;
    let winningSignals: StrategySignal[] = [];

    if (longCount > shortCount) {
      winningDirection = "LONG";
      winningCount = longCount;
      winningSignals = longSignals;
    } else if (shortCount > longCount) {
      winningDirection = "SHORT";
      winningCount = shortCount;
      winningSignals = shortSignals;
    }

    // Calculate consensus percentage
    const consensusPct = totalCount > 0 ? (winningCount / totalCount) * 100 : 0;

    // Calculate average confidence of winning direction signals
    const avgConfidence = winningSignals.length > 0
      ? winningSignals.reduce((sum, s) => sum + s.confidence, 0) / winningSignals.length
      : 0;

    // Check thresholds
    let approved = false;
    let rejectionReason: string | undefined;

    if (winningDirection === "HOLD") {
      rejectionReason = "No directional consensus (LONG/SHORT tied or all HOLD)";
    } else if (consensusPct < threshold.minConsensusPct) {
      rejectionReason = `Consensus ${consensusPct.toFixed(1)}% below minimum ${threshold.minConsensusPct}%`;
    } else if (avgConfidence < threshold.minAvgConfidence) {
      rejectionReason = `Avg confidence ${avgConfidence.toFixed(1)} below minimum ${threshold.minAvgConfidence}`;
    } else {
      approved = true;
    }

    return {
      category,
      longCount,
      shortCount,
      holdCount,
      totalCount,
      winningDirection,
      consensusPct,
      avgConfidence,
      approved,
      rejectionReason,
      winningSignals,
    };
  }

  /**
   * Fee-aware profitability check for scalping trades.
   * Rejects trades where expected net profit doesn't justify fees.
   */
  private static checkFeeEfficiency(signal: StrategySignal): { passed: boolean; reason?: string } {
    const entry = signal.entry;
    const tp = signal.takeProfit;

    if (!entry || !tp || entry <= 0 || tp <= 0) {
      return { passed: true }; // Can't calculate, allow through
    }

    // Use a nominal quantity of 1 unit for ratio calculation
    const quantity = 1;
    const expectedGrossProfit = Math.abs(tp - entry) * quantity;
    const estimatedEntryFee = entry * quantity * TAKER_FEE_RATE;
    const estimatedExitFee = tp * quantity * TAKER_FEE_RATE;
    const totalFees = estimatedEntryFee + estimatedExitFee;

    if (expectedGrossProfit <= MIN_PROFIT_FEE_MULTIPLE * totalFees) {
      return {
        passed: false,
        reason: `FEE_INEFFICIENT_SCALP: Expected gross profit ($${expectedGrossProfit.toFixed(4)}) ≤ ${MIN_PROFIT_FEE_MULTIPLE}× total fees ($${totalFees.toFixed(4)}). ` +
          `Entry: $${entry}, TP: $${tp}, Fee rate: ${(TAKER_FEE_RATE * 100).toFixed(2)}%`,
      };
    }

    return { passed: true };
  }

  /**
   * Structured consensus logging.
   */
  private static logConsensus(result: CategoryConsensus): void {
    console.log(
      `[CONSENSUS] Category: ${result.category} | ` +
      `LONG: ${result.longCount} | SHORT: ${result.shortCount} | HOLD: ${result.holdCount} | ` +
      `Consensus: ${result.consensusPct.toFixed(1)}% ${result.winningDirection} | ` +
      `Avg Confidence: ${result.avgConfidence.toFixed(1)} | ` +
      `${result.approved ? "✅ APPROVED" : `❌ REJECTED (${result.rejectionReason})`}`
    );
  }

  /**
   * Get the allowed consensus categories for a user's preferred trading mode.
   */
  public static getAllowedCategories(userMode: string): ConsensusCategory[] {
    return USER_MODE_CATEGORY_MAP[userMode] || [
      ConsensusCategory.SCALPING,
      ConsensusCategory.INTRADAY,
      ConsensusCategory.DEFENSIVE,
    ];
  }

  /**
   * Filter a ConsensusResult to only include categories allowed for a user.
   */
  public static filterForUser(result: ConsensusResult, userMode: string): ConsensusResult {
    const allowed = this.getAllowedCategories(userMode);

    const filteredApproved = result.approvedCategories.filter(c => allowed.includes(c.category));
    const filteredCategoryResults = result.categoryResults.filter(c => allowed.includes(c.category));

    // Re-pick best from filtered
    let bestCategory: CategoryConsensus | null = null;
    if (filteredApproved.length > 0) {
      filteredApproved.sort((a, b) => {
        const scoreA = a.consensusPct * a.avgConfidence;
        const scoreB = b.consensusPct * b.avgConfidence;
        return scoreB - scoreA;
      });
      bestCategory = filteredApproved[0];
    }

    let bestSignal: StrategySignal | null = null;
    if (bestCategory && bestCategory.winningSignals.length > 0) {
      const sorted = [...bestCategory.winningSignals].sort((a, b) => {
        const scoreA = (a as any).finalScore ?? a.confidence;
        const scoreB = (b as any).finalScore ?? b.confidence;
        return scoreB - scoreA;
      });
      bestSignal = sorted[0];
    }

    return {
      categoryResults: filteredCategoryResults,
      approvedCategories: filteredApproved,
      bestCategory,
      bestSignal,
      feeRejected: result.feeRejected,
      feeRejectionReason: result.feeRejectionReason,
    };
  }
}
