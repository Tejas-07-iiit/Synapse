import { StrategySignal } from "../types";

export class SignalUtils {
  /**
   * Helper to verify signal fields for contract correctness.
   */
  public static validateSignal(sig: StrategySignal): boolean {
    if (!sig.symbol || !sig.timeframe || !sig.strategyId) return false;
    if (!["LONG", "SHORT", "HOLD"].includes(sig.signal)) return false;
    if (sig.confidence < 0 || sig.confidence > 100) return false;
    if (sig.entry < 0 || sig.stopLoss < 0 || sig.takeProfit < 0) return false;
    if (isNaN(sig.timestamp)) return false;
    return true;
  }
}
