import { VirtualOrder } from "../types";
import { useSettingsStore } from "@/src/stores/settingsStore";

export interface RiskCheckSettings {
  autoTrading: boolean;
  maxOpenTrades: number;
}

export class RiskEngine {
  /**
   * Validates a proposed order against risk parameters.
   * Accepts explicit settings to work in both browser (Zustand) and daemon (DB) modes.
   * If no explicit settings are provided, falls back to Zustand store (browser mode).
   */
  public static validateOrder(
    order: VirtualOrder,
    activePositionsCount: number,
    alreadyOpenForSymbol: boolean,
    leverage: number,
    availableBalance: number,
    explicitSettings?: RiskCheckSettings
  ): { allowed: boolean; reason?: string } {
    const settings = explicitSettings || useSettingsStore.getState();

    // 0.5. Symbol lock check
    if (alreadyOpenForSymbol) {
      return {
        allowed: false,
        reason: `Active position already exists for ${order.symbol}`,
      };
    }

    // 0. Auto-trading toggle
    const isAutoTradingEnabled = settings.autoTrading || 
      process.env.NEXT_PUBLIC_AUTONOMOUS_TRADING === "true" || 
      process.env.NEXT_PUBLIC_AUTONOMOUS_TRADING === "on";

    if (!isAutoTradingEnabled) {
      return {
        allowed: false,
        reason: `Auto-trading is currently disabled in settings and env.`,
      };
    }

    // 1. Limit active positions count
    if (activePositionsCount >= settings.maxOpenTrades) {
      return {
        allowed: false,
        reason: `Risk Limit Exceeded: Maximum open positions (${settings.maxOpenTrades}) reached.`,
      };
    }

    // 2. Limit trade size based on risk % and available balance (Margin check)
    const orderValueUsdt = order.price * order.quantity;
    const requiredMargin = orderValueUsdt / leverage;
    
    if (requiredMargin > availableBalance) {
      return {
        allowed: false,
        reason: `Insufficient Margin: Required margin ($${requiredMargin.toFixed(2)}) exceeds available balance ($${availableBalance.toFixed(2)}).`,
      };
    }

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
