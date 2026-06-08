import assert from "node:assert/strict";
import { IndicatorEngine } from "../indicators/IndicatorEngine";
import { RiskEngine } from "../risk/RiskEngine";
import { ExecutionService } from "../execution/ExecutionService";
import type { MCXSignal } from "../types";

function closedCandle(index: number, close: number) {
  return {
    id: `c${index}`,
    symbol: "GOLD",
    token: "t",
    exchange: "MCX",
    expiry: new Date("2026-12-31"),
    contractName: "GOLD-FUT",
    interval: "1m",
    open: close - 1,
    high: close + 2,
    low: close - 2,
    close,
    volume: 100 + index,
    timestamp: new Date(1_700_000_000_000 + index * 60_000),
    isClosed: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

const candles = Array.from({ length: 60 }, (_, index) => closedCandle(index, 100 + index));
const indicators = IndicatorEngine.calculate(candles);
assert.equal(typeof indicators.ema20, "number", "EMA20 should be calculated from closed candles");
assert.equal(typeof indicators.rsi, "number", "RSI should be calculated from closed candles");
assert.equal(typeof indicators.atr, "number", "ATR should be calculated from closed candles");
assert.equal(IndicatorEngine.alignChart(candles).length, candles.length, "Chart output should preserve closed candle alignment");

const wallet = {
  id: "w",
  userId: "u",
  equity: 1_000_000,
  availableBalance: 1_000_000,
  blockedMargin: 0,
  realizedPnL: 0,
  unrealizedPnL: 0,
  tradingHalted: false,
  haltReason: null,
  dayStartEquity: 1_000_000,
  highWatermarkEquity: 1_000_000,
  riskConfigVersion: "test",
  createdAt: new Date(),
  updatedAt: new Date(),
};
const signal: MCXSignal = {
  userId: "u",
  symbol: "GOLD",
  direction: "BUY",
  confidence: 0.8,
  strategyId: "test",
  strategyName: "Test",
  timeframe: "1m",
  entryPrice: 100,
  stopLoss: 90,
  takeProfit: 120,
  generatedAt: new Date(),
};
const sizing = RiskEngine.calculatePositionSize(wallet, signal);
assert.equal(sizing.riskAmount, 10_000, "Risk amount should equal equity x configured risk percent");
assert.equal(sizing.lots, 10, "Lots should use stop distance and point value");
assert.equal(ExecutionService.pnlFor({ side: "LONG", entryPrice: 100, lots: 2, pointValue: 100 }, 110), 2_000, "Long PnL should use point value");
assert.equal(ExecutionService.pnlFor({ side: "SHORT", entryPrice: 100, lots: 2, pointValue: 100 }, 90), 2_000, "Short PnL should use point value");

console.log("MCX unit tests passed: indicators, chart alignment, risk sizing, PnL.");
