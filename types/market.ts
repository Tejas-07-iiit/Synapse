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

export interface BinanceTickerPayload {
  e: string;      // Event type
  E: number;      // Event time
  s: string;      // Symbol
  p: string;      // Price change
  P: string;      // Price change percent
  w: string;      // Weighted average price
  x: string;      // First trade(F)-1 price
  c: string;      // Last price (Current Price)
  Q: string;      // Last quantity
  b: string;      // Best bid price
  B: string;      // Best bid quantity
  a: string;      // Best ask price
  A: string;      // Best ask quantity
  o: string;      // Open price
  h: string;      // High price
  l: string;      // Low price
  v: string;      // Total traded base asset volume
  q: string;      // Total traded quote asset volume
  O: number;      // Statistics open time
  C: number;      // Statistics close time
  F: number;      // First trade ID
  L: number;      // Last trade ID
  n: number;      // Total number of trades
}

export interface CoinMetadata {
  symbol: string;
  name: string;
  displayName: string;
}

export interface AISignal {
  symbol: string;
  type: "LONG" | "SHORT";
  entry: number;
  target: number;
  stopLoss: number;
  confidence: number;
  status: string;
  timestamp: string;
}

export interface Candle {
  time: number; // UTC timestamp in milliseconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
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

export interface MarketAnalytics {
  symbol: string;
  trendDirection: "BULLISH" | "BEARISH" | "NEUTRAL";
  rsiStatus: "OVERBOUGHT" | "OVERSOLD" | "NEUTRAL";
  volatilityScore: "HIGH" | "LOW" | "NORMAL";
  momentumScore: "STRONG" | "WEAK" | "NEUTRAL";
  volumeStrength: "HIGH" | "LOW" | "NORMAL";
  marketRegime: "BULLISH" | "BEARISH" | "SIDEWAYS" | "VOLATILE" | "ACCUMULATION" | "DISTRIBUTION" | "Bullish Trend" | "Bearish Trend" | "Ranging" | "Breakout" | "Distribution" | "Accumulation" | "High Volatility" | "Low Volatility";
  emaAlignment: "BULLISH" | "BEARISH" | "NEUTRAL";
  bollingerPosition: "ABOVE_UPPER" | "BELOW_LOWER" | "IN_CHANNEL";
  macdStatus: "BULLISH_CROSSOVER" | "BEARISH_CROSSOVER" | "NEUTRAL";
  marketScore: number;
  summary: string;
}
