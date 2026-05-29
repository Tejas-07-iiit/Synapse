import { VirtualOrder } from "../types";
import { useSettingsStore } from "@/src/stores/settingsStore";

export class RiskEngine {
  /**
   * Validates a proposed order against risk parameters.
   */
  public static validateOrder(
    order: VirtualOrder,
    activePositionsCount: number,
    alreadyOpenForSymbol: boolean,
    leverage: number,
    availableBalance: number
  ): { allowed: boolean; reason?: string } {
    const settings = useSettingsStore.getState();

    console.log(`[RISK_ENGINE] Validating order: ${order.direction} ${order.symbol} @ $${order.price} | Qty: ${order.quantity} | Leverage: ${leverage}x | Available: $${availableBalance.toFixed(2)}`);

    // 0.5. Symbol lock check
    if (alreadyOpenForSymbol) {
      const reason = `Active position already exists for ${order.symbol}`;
      console.log(`[POSITION_LOCK] ${order.symbol} blocked → existing active trade found`);
      console.log(`[TRADE_REJECTED] Reason: ${reason}`);
      return {
        allowed: false,
        reason,
      };
    }

    // 0. Auto-trading toggle
    const isAutoTradingEnabled = settings.autoTrading || 
      process.env.NEXT_PUBLIC_AUTONOMOUS_TRADING === "true" || 
      process.env.NEXT_PUBLIC_AUTONOMOUS_TRADING === "on";

    if (!isAutoTradingEnabled) {
      const reason = `Auto-trading is currently disabled in settings and env.`;
      console.log(`[POSITION_REJECTED] Risk Engine rejection: ${reason}`);
      return {
        allowed: false,
        reason,
      };
    }

    // 1. Limit active positions count
    if (activePositionsCount >= settings.maxOpenTrades) {
      const reason = `Risk Limit Exceeded: Maximum open positions (${settings.maxOpenTrades}) reached.`;
      console.log(`[POSITION_REJECTED] Risk Engine rejection: ${reason}`);
      return {
        allowed: false,
        reason,
      };
    }

    // 2. Limit trade size based on risk % and available balance (Margin check)
    const orderValueUsdt = order.price * order.quantity;
    const requiredMargin = orderValueUsdt / leverage;
    
    if (requiredMargin > availableBalance) {
      const reason = `Insufficient Margin: Required margin ($${requiredMargin.toFixed(2)}) exceeds available balance ($${availableBalance.toFixed(2)}).`;
      console.log(`[POSITION_REJECTED] Risk Engine rejection: ${reason}`);
      return {
        allowed: false,
        reason,
      };
    }

    console.log(`[RISK_ENGINE] Order approved by Risk Engine.`);
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
