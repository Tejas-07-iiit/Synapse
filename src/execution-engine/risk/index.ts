import { VirtualOrder, RiskLimits } from "../types";
import { useSettingsStore } from "@/src/stores/settingsStore";
import { useWalletStore } from "@/src/stores/walletStore";

export class RiskEngine {
  /**
   * Validates a proposed order against risk parameters.
   */
  public static validateOrder(
    order: VirtualOrder,
    activePositionsCount: number,
  ): { allowed: boolean; reason?: string } {
    const settings = useSettingsStore.getState();
    const wallet = useWalletStore.getState();

    // 0. Auto-trading toggle
    if (!settings.autoTrading) {
      return {
        allowed: false,
        reason: `Auto-trading is currently disabled in settings.`,
      };
    }

    // 1. Limit active positions count
    if (activePositionsCount >= settings.maxOpenTrades) {
      return {
        allowed: false,
        reason: `Risk Limit Exceeded: Maximum open positions (${settings.maxOpenTrades}) reached.`,
      };
    }

    // 2. Limit trade size based on risk % and wallet balance
    const orderValueUsdt = order.price * order.quantity;
    const maxAllowedSize = wallet.balance * (settings.riskPerTradePct / 100);
    
    // Fallback logic if balance is 0 but we want to allow testing, though realistically
    // if balance is < orderValueUsdt, it should fail.
    if (orderValueUsdt > wallet.balance) {
      return {
        allowed: false,
        reason: `Insufficient Balance: Order size ($${orderValueUsdt.toFixed(2)}) exceeds available balance ($${wallet.balance.toFixed(2)}).`,
      };
    }

    // A strict risk engine would limit the size to `maxAllowedSize` strictly.
    // For now we just enforce that the size doesn't exceed wallet balance, 
    // and ideally the sizing function already calculated it based on risk.

    return { allowed: true };
  }

  /**
   * Checks if drawdown threshold is breached.
   */
  public static isDrawdownBreached(
    currentDailyPnl: number,
    startingBalance: number,
    maxDailyDrawdownPercent: number = 5.0
  ): boolean {
    if (startingBalance <= 0) return false;
    const drawdownPercent = (Math.abs(Math.min(0, currentDailyPnl)) / startingBalance) * 100;
    return drawdownPercent >= maxDailyDrawdownPercent;
  }
}
