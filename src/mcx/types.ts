import type { MCXInterval } from "./config/mcx.config";

export type MCXDirection = "BUY" | "SELL" | "HOLD";
export type MCXPositionSide = "LONG" | "SHORT";
export type MCXExitReason = "SL" | "TP" | "TRAILING_SL" | "MANUAL" | "RISK_LOCK";

export interface NormalizedMCXTick {
  symbol: string;
  token: string;
  exchange: string;
  expiry: Date;
  contractName: string;
  price: number;
  volume: number;
  timestamp: Date;
  raw?: unknown;
}

export interface MCXCandleData extends Omit<NormalizedMCXTick, "price" | "raw"> {
  interval: MCXInterval;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: Date;
  isClosed: boolean;
}

export interface MCXSignal {
  userId: string;
  symbol: string;
  direction: MCXDirection;
  confidence: number;
  strategyId: string;
  strategyName: string;
  timeframe: MCXInterval;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  generatedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface PositionSizingResult {
  lots: number;
  quantity: number;
  riskAmount: number;
  stopDistance: number;
  pointValue: number;
  marginRequired: number;
}
