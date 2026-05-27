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
