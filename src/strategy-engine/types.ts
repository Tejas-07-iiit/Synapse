export interface Candle {
  time: number; // UTC timestamp in milliseconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TickerInfo {
  symbol: string;
  price: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  lastUpdate: number;
}

export interface IndicatorValues {
  ema12: number[];
  ema26: number[];
  ema20: number[];
  sma50: number[];
  rsi: number[];
  macdLine: number[];
  signalLine: number[];
  macdHist: number[];
  bbUpper: number[];
  bbMiddle: number[];
  bbLower: number[];
  atr: number[];
  vwap: number[];
  volumeMA: number[];
  stochRsiK: number[];
  stochRsiD: number[];
  adx: number[];
  supportLevels: number[];
  resistanceLevels: number[];
}

export interface StrategyContext {
  symbol: string;
  timeframe: string;
  candles: Candle[];
  ticker: TickerInfo | null;
  indicators: IndicatorValues;
  historicalIndicators?: Record<string, IndicatorValues>; // symbol/timeframe -> indicators mapping for multi-timeframe confirmation
}

export interface StrategySignal {
  strategyId: string;
  strategyName: string;
  symbol: string;
  timeframe: string;
  signalType: "LONG" | "SHORT" | "HOLD"; // Required in Phase 4
  signal: "LONG" | "SHORT" | "HOLD";     // Kept for backward compatibility
  confidence: number; // 0 to 100
  entry: number;
  stopLoss: number;
  takeProfit: number;
  reasoning: string[];
  indicators: {
    rsi?: number;
    ema?: number;
    sma?: number;
    macd?: number;
    atr?: number;
    volume?: number;
    stochRsiK?: number;
    stochRsiD?: number;
    adx?: number;
    support?: number;
    resistance?: number;
    [key: string]: number | undefined;
  };
  timestamp: number;
}

export interface TradingStrategy {
  id: string;
  name: string;
  description: string;
  timeframe?: string;            // Standard single timeframe representation
  timeframes?: string[];         // Array of timeframes for backward compatibility
  symbols?: string[];            // Active symbols
  enabled: boolean;
  indicatorsRequired: string[];

  // Core Phase 4 methods
  analyze(context: StrategyContext): { direction: "LONG" | "SHORT" | "HOLD"; reasoning: string[] };
  validate(context: StrategyContext): boolean;
  generateSignal(context: StrategyContext): StrategySignal;

  // Evaluation runner (incorporates analyze, validate, generateSignal)
  evaluate(context: StrategyContext): StrategySignal;
}
