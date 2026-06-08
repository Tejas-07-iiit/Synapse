-- MCX V2 independent Postgres schema. Crypto tables are intentionally untouched.
CREATE TABLE IF NOT EXISTS "synapse"."McxInstrument" (
  "id" TEXT PRIMARY KEY,
  "symbol" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "exchange" TEXT NOT NULL,
  "expiry" TIMESTAMP(3) NOT NULL,
  "contractName" TEXT NOT NULL,
  "instrumentType" TEXT NOT NULL,
  "lotSize" DOUBLE PRECISION NOT NULL,
  "tickSize" DOUBLE PRECISION NOT NULL,
  "raw" JSONB NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "syncedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "McxInstrument_symbol_exchange_expiry_contractName_key" ON "synapse"."McxInstrument"("symbol", "exchange", "expiry", "contractName");
CREATE UNIQUE INDEX IF NOT EXISTS "McxInstrument_token_exchange_key" ON "synapse"."McxInstrument"("token", "exchange");
CREATE INDEX IF NOT EXISTS "McxInstrument_symbol_active_expiry_idx" ON "synapse"."McxInstrument"("symbol", "active", "expiry");

CREATE TABLE IF NOT EXISTS "synapse"."McxTick" (
  "id" TEXT PRIMARY KEY,
  "symbol" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "exchange" TEXT NOT NULL,
  "expiry" TIMESTAMP(3) NOT NULL,
  "contractName" TEXT NOT NULL,
  "price" DOUBLE PRECISION NOT NULL,
  "volume" DOUBLE PRECISION NOT NULL,
  "timestamp" TIMESTAMP(3) NOT NULL,
  "raw" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "McxTick_symbol_timestamp_idx" ON "synapse"."McxTick"("symbol", "timestamp");
CREATE INDEX IF NOT EXISTS "McxTick_token_timestamp_idx" ON "synapse"."McxTick"("token", "timestamp");

CREATE TABLE IF NOT EXISTS "synapse"."McxCandle" (
  "id" TEXT PRIMARY KEY,
  "symbol" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "exchange" TEXT NOT NULL,
  "expiry" TIMESTAMP(3) NOT NULL,
  "contractName" TEXT NOT NULL,
  "interval" TEXT NOT NULL,
  "open" DOUBLE PRECISION NOT NULL,
  "high" DOUBLE PRECISION NOT NULL,
  "low" DOUBLE PRECISION NOT NULL,
  "close" DOUBLE PRECISION NOT NULL,
  "volume" DOUBLE PRECISION NOT NULL,
  "timestamp" TIMESTAMP(3) NOT NULL,
  "isClosed" BOOLEAN NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "McxCandle_symbol_interval_timestamp_key" ON "synapse"."McxCandle"("symbol", "interval", "timestamp");
CREATE INDEX IF NOT EXISTS "McxCandle_symbol_interval_isClosed_timestamp_idx" ON "synapse"."McxCandle"("symbol", "interval", "isClosed", "timestamp");

CREATE TABLE IF NOT EXISTS "synapse"."McxWallet" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE,
  "equity" DOUBLE PRECISION NOT NULL,
  "availableBalance" DOUBLE PRECISION NOT NULL,
  "blockedMargin" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "realizedPnL" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "unrealizedPnL" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "tradingHalted" BOOLEAN NOT NULL DEFAULT false,
  "haltReason" TEXT,
  "dayStartEquity" DOUBLE PRECISION NOT NULL,
  "highWatermarkEquity" DOUBLE PRECISION NOT NULL,
  "riskConfigVersion" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "synapse"."McxPosition" (
  "id" TEXT PRIMARY KEY,
  "openKey" TEXT UNIQUE,
  "userId" TEXT NOT NULL,
  "symbol" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "exchange" TEXT NOT NULL,
  "expiry" TIMESTAMP(3) NOT NULL,
  "contractName" TEXT NOT NULL,
  "side" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "entryPrice" DOUBLE PRECISION NOT NULL,
  "exitPrice" DOUBLE PRECISION,
  "currentPrice" DOUBLE PRECISION NOT NULL,
  "stopLoss" DOUBLE PRECISION NOT NULL,
  "takeProfit" DOUBLE PRECISION NOT NULL,
  "trailingStop" DOUBLE PRECISION,
  "quantity" DOUBLE PRECISION NOT NULL,
  "lots" DOUBLE PRECISION NOT NULL,
  "pointValue" DOUBLE PRECISION NOT NULL,
  "marginUsed" DOUBLE PRECISION NOT NULL,
  "riskAmount" DOUBLE PRECISION NOT NULL,
  "pnl" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "unrealizedPnL" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "strategyId" TEXT NOT NULL,
  "strategyName" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3),
  "exitReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "McxPosition_userId_status_idx" ON "synapse"."McxPosition"("userId", "status");
CREATE INDEX IF NOT EXISTS "McxPosition_symbol_status_idx" ON "synapse"."McxPosition"("symbol", "status");

CREATE TABLE IF NOT EXISTS "synapse"."McxTrade" (
  "id" TEXT PRIMARY KEY,
  "tradeId" TEXT NOT NULL UNIQUE,
  "userId" TEXT NOT NULL,
  "positionId" TEXT,
  "symbol" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "exchange" TEXT NOT NULL,
  "expiry" TIMESTAMP(3) NOT NULL,
  "contractName" TEXT NOT NULL,
  "side" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "lots" DOUBLE PRECISION NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL,
  "price" DOUBLE PRECISION NOT NULL,
  "entryPrice" DOUBLE PRECISION,
  "exitPrice" DOUBLE PRECISION,
  "stopLoss" DOUBLE PRECISION,
  "takeProfit" DOUBLE PRECISION,
  "strategy" TEXT NOT NULL,
  "aiConfidence" DOUBLE PRECISION NOT NULL,
  "profit" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL,
  "reason" TEXT,
  "idempotencyKey" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "McxTrade_userId_symbol_createdAt_idx" ON "synapse"."McxTrade"("userId", "symbol", "createdAt");

CREATE TABLE IF NOT EXISTS "synapse"."McxEventLog" (
  "id" TEXT PRIMARY KEY,
  "type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "McxEventLog_type_idx" ON "synapse"."McxEventLog"("type");
CREATE INDEX IF NOT EXISTS "McxEventLog_createdAt_idx" ON "synapse"."McxEventLog"("createdAt");

CREATE TABLE IF NOT EXISTS "synapse"."McxExecutionLock" (
  "key" TEXT PRIMARY KEY,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "McxExecutionLock_expiresAt_idx" ON "synapse"."McxExecutionLock"("expiresAt");

CREATE TABLE IF NOT EXISTS "synapse"."McxStrategyState" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "strategyId" TEXT NOT NULL,
  "symbol" TEXT NOT NULL,
  "state" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "McxStrategyState_userId_strategyId_symbol_key" ON "synapse"."McxStrategyState"("userId", "strategyId", "symbol");
