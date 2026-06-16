export type MCXInterval = "1m" | "5m" | "15m";
export type MCXSymbol = string;

export interface MCXSymbolConfig {
  symbol: MCXSymbol;
  pointValue: number;
  lotSize: number;
  marginPerLot: number;
  tickSize: number;
}

export interface MCXRiskConfig {
  maxRiskPerTradePct: number;
  maxPortfolioExposurePct: number;
  maxSimultaneousPositions: number;
  dailyLossLimitPct: number;
  dailyDrawdownLockPct: number;
  minConfidence: number;
}

export interface MCXConfig {
  marketData: {
    instrumentMasterUrl: string;
    exchange: string;
    symbols: MCXSymbol[];
    intervals: MCXInterval[];
    priceMismatchTolerancePct: number;
    maxTickAgeMs: number;
    allowPriceTransforms: boolean;
    credentials: {
      apiKey: string;
      clientId: string;
      password: string;
      totpSecret: string;
      secretKey: string;
    };
  };
  risk: MCXRiskConfig;
  runtime: {
    defaultUserId: string;
    defaultWalletEquity: number;
    strategyLookbackCandles: number;
  };
  symbols: Record<MCXSymbol, MCXSymbolConfig>;
}

function numberFromEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stringFromEnv(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

function symbolConfig(symbol: string, lotSize: number, pointValue: number, marginPerLot: number, tickSize: number): MCXSymbolConfig {
  return {
    symbol,
    lotSize: numberFromEnv(`MCX_${symbol}_LOT_SIZE`, lotSize),
    pointValue: numberFromEnv(`MCX_${symbol}_POINT_VALUE`, pointValue),
    marginPerLot: numberFromEnv(`MCX_${symbol}_MARGIN_PER_LOT`, marginPerLot),
    tickSize: numberFromEnv(`MCX_${symbol}_TICK_SIZE`, tickSize),
  };
}

const configuredSymbols = stringFromEnv("MCX_SYMBOLS", "GOLD,SILVER,CRUDEOIL,NATURALGAS,COPPER")
  .split(",")
  .map((symbol) => symbol.trim().toUpperCase())
  .filter(Boolean);

const configuredIntervals = stringFromEnv("MCX_INTERVALS", "1m,5m,15m")
  .split(",")
  .map((interval) => interval.trim() as MCXInterval)
  .filter((interval): interval is MCXInterval => interval === "1m" || interval === "5m" || interval === "15m");

export const mcxConfig: MCXConfig = {
  marketData: {
    instrumentMasterUrl: stringFromEnv(
      "ANGEL_ONE_INSTRUMENT_MASTER_URL",
      "https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json"
    ),
    exchange: stringFromEnv("MCX_EXCHANGE", "MCX"),
    symbols: configuredSymbols,
    intervals: configuredIntervals,
    priceMismatchTolerancePct: numberFromEnv("MCX_PRICE_MISMATCH_TOLERANCE_PCT", 0),
    maxTickAgeMs: numberFromEnv("MCX_MAX_TICK_AGE_MS", 0),
    allowPriceTransforms: stringFromEnv("MCX_ALLOW_PRICE_TRANSFORMS", "false") === "true",
    credentials: {
      apiKey: stringFromEnv("MCX_API_KEY", ""),
      clientId: stringFromEnv("MCX_CLIENT_ID", ""),
      password: stringFromEnv("MCX_PASSWORD", ""),
      totpSecret: stringFromEnv("MCX_TOTP_SECRET", ""),
      secretKey: stringFromEnv("MCX_SECRET_KEY", ""),
    },
  },
  risk: {
    maxRiskPerTradePct: numberFromEnv("MCX_MAX_RISK_PER_TRADE_PCT", 0.02),
    maxPortfolioExposurePct: numberFromEnv("MCX_MAX_PORTFOLIO_EXPOSURE_PCT", 0.50),
    maxSimultaneousPositions: numberFromEnv("MCX_MAX_SIMULTANEOUS_POSITIONS", 3),
    dailyLossLimitPct: numberFromEnv("MCX_DAILY_LOSS_LIMIT_PCT", 0.1),
    dailyDrawdownLockPct: numberFromEnv("MCX_DAILY_DRAWDOWN_LOCK_PCT", 0.15),
    minConfidence: numberFromEnv("MCX_MIN_SIGNAL_CONFIDENCE", 0.01),
  },
  runtime: {
    defaultUserId: stringFromEnv("MCX_DEFAULT_USER_ID", "SYSTEM_MCX_USER"),
    defaultWalletEquity: numberFromEnv("MCX_DEFAULT_WALLET_EQUITY", 0),
    strategyLookbackCandles: numberFromEnv("MCX_STRATEGY_LOOKBACK_CANDLES", 100),
  },
  symbols: {
    GOLD: symbolConfig("GOLD", 100, 100, 40000, 1),
    SILVER: symbolConfig("SILVER", 30, 30, 20000, 1),
    CRUDEOIL: symbolConfig("CRUDEOIL", 100, 100, 20000, 1),
    NATURALGAS: symbolConfig("NATURALGAS", 1250, 1250, 30000, 0.1),
    COPPER: symbolConfig("COPPER", 2500, 2500, 35000, 0.05),
  },
};

export function getMCXSymbolConfig(symbol: string): MCXSymbolConfig {
  const config = mcxConfig.symbols[symbol.toUpperCase()];
  if (!config) throw new Error(`MCX symbol is not configured: ${symbol}`);
  return config;
}
