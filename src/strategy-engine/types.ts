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
  donchianUpper?: number[];
  donchianLower?: number[];
  donchianMiddle?: number[];
  mfi?: number[];
  momentum?: number[];
  structure?: MarketStructureData;
}

export interface SwingPoint {
  index: number;
  price: number;
  type: "HIGH" | "LOW";
  timestamp: number;
}

export interface SupplyDemandZone {
  id: string;
  type: "SUPPLY" | "DEMAND";
  high: number;
  low: number;
  volumeSpike: boolean;
  departureStrength: number;
  freshness: boolean;
  reactionCount: number;
  createdAtIndex: number;
  createdAtTime: number;
}

export interface MarketStructureData {
  donchian: {
    upper: number[];
    lower: number[];
    middle: number[];
  };
  swings: SwingPoint[];
  zones: SupplyDemandZone[];
  sweeps: {
    time: number;
    highSwept: boolean;
    lowSwept: boolean;
    highSweptPrice: number;
    lowSweptPrice: number;
  }[];
  dowStructure: "BULLISH" | "BEARISH" | "RANGING";
}

export interface StrategyContext {
  symbol: string;
  timeframe: string;
  candles: Candle[];
  ticker: TickerInfo | null;
  indicators: IndicatorValues;
  historicalIndicators?: Record<string, IndicatorValues>; // symbol/timeframe -> indicators mapping for multi-timeframe confirmation
  structure?: MarketStructureData;
}

export interface StrategySignal {
  strategyId: string;
  strategyName: string;
  strategyCategory?: string;
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  };
  marketContext?: {
    regime: string;
    regimeCategory: string;
    volatilityState: {
      currentWidth: number;
      avgWidth: number;
      isExpanding: boolean;
      atr: number;
    };
    breakoutStrength: {
      bbWidth: number;
      prevBbWidth: number;
      bodyRatio: number;
      volumeRatio: number;
      upperWickRatio: number;
      lowerWickRatio: number;
    };
    featureVector?: number[];
    probability?: number;
    zoneData?: {
      id: string;
      type: "SUPPLY" | "DEMAND";
      high: number;
      low: number;
      freshness: boolean;
      reactionCount: number;
      departureStrength: number;
    };
    sweepMetadata?: {
      sweepPrice: number;
      rangeHigh: number;
      rangeLow: number;
      rangeMidpoint: number;
      rsi: number;
    };
    mfi?: number;
    momentum?: number;
    dowStructure?: string;
  };
  timestamp: number;
  blocked?: boolean;
  blockReason?: string;
  activePositionId?: string;
}


export interface TradingStrategy {
  id: string;
  name: string;
  description: string;
  type?: string;
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
