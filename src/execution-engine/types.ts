export interface VirtualPosition {
  id: string;
  userId?: string;
  symbol: string;
  direction: "LONG" | "SHORT";
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  stopLoss: number | null;
  takeProfit: number | null;
  leverage: number;
  pnl: number;
  status: "OPEN" | "CLOSED";
  openedAt: number;
  closedAt: number | null;
  // Strategy intelligence fields
  strategyId?: string;
  strategyName?: string;
  strategyCategory?: string;
  entryReason?: string;
  confidenceAtEntry?: number;
  marketRegime?: string;
  indicatorSnapshot?: any;
  expiresAt?: string | number | Date | null;
  exitReason?: string | null;
  confidenceScore?: number | null;
  auditPayload?: any;
  timeframe?: string;
}

export interface VirtualOrder {
  id: string;
  symbol: string;
  direction: "LONG" | "SHORT";
  type: "LIMIT" | "MARKET" | "STOP_MARKET" | "TAKE_PROFIT_MARKET";
  price: number;
  quantity: number;
  stopPrice?: number;
  status: "PENDING" | "FILLED" | "CANCELLED";
  timestamp: number;
}

export interface RiskLimits {
  maxLeverage: number;
  maxPositionSizeUsdt: number;
  maxOpenPositions: number;
  maxDailyDrawdownPercent: number;
}
