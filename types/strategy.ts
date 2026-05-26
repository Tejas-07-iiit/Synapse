import { Candle, TickerInfo, IndicatorValues } from "./market";

export interface StrategySignal {
  symbol: string;
  direction: "LONG" | "SHORT" | "HOLD";
  confidence: number; // 0 to 100
  timeframe: string;
  strategyId: string;
  timestamp: number;
  indicators: {
    rsi: number;
    macdHist: number;
    price: number;
    [key: string]: number;
  };
  reasoning: string;
}

export interface StrategyContext {
  symbol: string;
  timeframe: string;
  candles: Candle[];
  ticker: TickerInfo | null;
  indicators: IndicatorValues | null;
}

export interface Strategy {
  id: string;
  name: string;
  supportedTimeframes: string[];
  
  analyze(context: StrategyContext): StrategySignal;
  validate(signal: StrategySignal): boolean;
}
