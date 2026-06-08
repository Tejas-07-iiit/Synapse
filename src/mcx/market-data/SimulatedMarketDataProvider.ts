import prisma from "@/lib/prisma";
import { mcxConfig, type MCXInterval, type MCXSymbol } from "../config/mcx.config";
import { getMCXSymbolConfig } from "../config/mcx.config";
import { MarketDataService } from "./MarketDataService";
import { mcxLogger } from "../utils/logger";

type ResolvedContract = {
  symbol: string;
  token: string;
  exchange: string;
  expiry: Date;
  contractName: string;
};

const DEFAULT_BASE_PRICES: Record<string, number> = {
  GOLD: 155_000,
  SILVER: 106_000,
  CRUDEOIL: 6_400,
  NATURALGAS: 250,
  COPPER: 890,
};

const DEFAULT_VOLATILITY: Record<string, number> = {
  GOLD: 55,
  SILVER: 95,
  CRUDEOIL: 14,
  NATURALGAS: 2.2,
  COPPER: 3.2,
};

export class SimulatedMarketDataProvider {
  private static timer: NodeJS.Timeout | null = null;
  private static readonly contractCache = new Map<string, ResolvedContract>();
  private static readonly lastPriceBySymbol = new Map<string, number>();
  private static unresolvedSymbols = new Set<string>();
  private static readonly historyLookbackCandles = 300;
  private static readonly intervalMs: Record<MCXInterval, number> = {
    "1m": 60_000,
    "5m": 300_000,
    "15m": 900_000,
  };

  static start(reason: string) {
    if (this.timer) return;
    mcxLogger.warn("SIMULATED_FEED_STARTED", { reason });
    void this.bootstrapHistoryAndAnchors();
    this.timer = setInterval(() => {
      void this.emitSyntheticTicks();
    }, 1000);
  }

  static stop() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
    this.contractCache.clear();
    this.unresolvedSymbols.clear();
    mcxLogger.info("SIMULATED_FEED_STOPPED");
  }

  private static async emitSyntheticTicks() {
    for (const symbol of mcxConfig.marketData.symbols) {
      await this.emitTickForSymbol(symbol);
    }
  }

  private static async emitTickForSymbol(symbol: MCXSymbol) {
    const normalized = symbol.toUpperCase();
    const contract = await this.resolveContract(normalized);
    if (!contract) return;

    const symbolCfg = getMCXSymbolConfig(normalized);
    const prevPrice = this.lastPriceBySymbol.get(normalized) ?? DEFAULT_BASE_PRICES[normalized] ?? 1000;
    const volatility = DEFAULT_VOLATILITY[normalized] ?? Math.max(prevPrice * 0.0003, symbolCfg.tickSize * 2);
    const randomMove = (Math.random() - 0.5) * volatility;

    let nextPrice = prevPrice + randomMove;
    if (!Number.isFinite(nextPrice) || nextPrice <= 0) {
      nextPrice = prevPrice;
    }

    const aligned = Math.max(symbolCfg.tickSize, this.roundToTick(nextPrice, symbolCfg.tickSize));
    this.lastPriceBySymbol.set(normalized, aligned);

    await MarketDataService.ingestTick({
      symbol: normalized,
      token: contract.token,
      price: aligned,
      volume: Math.round(20 + Math.random() * 180),
      timestamp: new Date(),
      raw: { provider: "simulated", mode: "fallback" },
    });
  }

  private static async bootstrapHistoryAndAnchors() {
    for (const symbol of mcxConfig.marketData.symbols) {
      const normalized = symbol.toUpperCase();
      const contract = await this.resolveContract(normalized);
      if (!contract) continue;

      const tick = await MarketDataService.latestTick(normalized);
      if (tick?.price && Number.isFinite(tick.price) && tick.price > 0) {
        this.lastPriceBySymbol.set(normalized, tick.price);
      }

      for (const interval of mcxConfig.marketData.intervals) {
        await this.seedHistoricalCandles(normalized, contract, interval);
      }

      if (!this.lastPriceBySymbol.has(normalized)) {
        const latestCandle = await prisma.mcxCandle.findFirst({
          where: { symbol: normalized, interval: "15m", isClosed: true },
          orderBy: { timestamp: "desc" },
          select: { close: true },
        });
        this.lastPriceBySymbol.set(normalized, latestCandle?.close ?? DEFAULT_BASE_PRICES[normalized] ?? 1000);
      }
    }
  }

  private static async seedHistoricalCandles(symbol: string, contract: ResolvedContract, interval: MCXInterval) {
    const bucketMs = this.intervalMs[interval];
    const now = Date.now();
    const latestClosedStart = Math.floor(now / bucketMs) * bucketMs - bucketMs;
    if (latestClosedStart <= 0) return;

    const oldestRequiredStart = latestClosedStart - (this.historyLookbackCandles - 1) * bucketMs;
    const existingCount = await prisma.mcxCandle.count({
      where: {
        symbol,
        interval,
        isClosed: true,
        timestamp: { gte: new Date(oldestRequiredStart), lte: new Date(latestClosedStart) },
      },
    });

    if (existingCount >= this.historyLookbackCandles * 0.9) {
      return;
    }

    let prevClose = this.lastPriceBySymbol.get(symbol);
    if (!prevClose) {
      const prior = await prisma.mcxCandle.findFirst({
        where: { symbol, interval, isClosed: true },
        orderBy: { timestamp: "desc" },
        select: { close: true },
      });
      prevClose = prior?.close ?? DEFAULT_BASE_PRICES[symbol] ?? 1000;
    }

    const symbolCfg = getMCXSymbolConfig(symbol);
    const volatility = DEFAULT_VOLATILITY[symbol] ?? Math.max(prevClose * 0.00035, symbolCfg.tickSize * 2);
    const candlesToCreate = [];

    for (let i = 0; i < this.historyLookbackCandles; i += 1) {
      const ts = oldestRequiredStart + i * bucketMs;
      const open = prevClose;
      const close = this.roundToTick(open + (Math.random() - 0.5) * volatility, symbolCfg.tickSize);
      const high = this.roundToTick(Math.max(open, close) + Math.random() * volatility * 0.4, symbolCfg.tickSize);
      const low = this.roundToTick(Math.min(open, close) - Math.random() * volatility * 0.4, symbolCfg.tickSize);

      candlesToCreate.push({
        symbol,
        token: contract.token,
        exchange: contract.exchange,
        expiry: contract.expiry,
        contractName: contract.contractName,
        interval,
        timestamp: new Date(ts),
        open,
        high: Math.max(high, open, close),
        low: Math.min(low, open, close),
        close,
        volume: Math.round(500 + Math.random() * 7_500),
        isClosed: true,
      });

      prevClose = close;
    }

    if (candlesToCreate.length > 0) {
      await prisma.mcxCandle.createMany({
        data: candlesToCreate,
        skipDuplicates: true,
      });
      this.lastPriceBySymbol.set(symbol, candlesToCreate[candlesToCreate.length - 1].close);
      mcxLogger.info("SIMULATED_HISTORY_SEEDED", { symbol, interval, created: candlesToCreate.length });
    }
  }

  private static async resolveContract(symbol: string): Promise<ResolvedContract | null> {
    const cached = this.contractCache.get(symbol);
    if (cached) return cached;

    try {
      const contract = await MarketDataService.resolveContract(symbol);
      const resolved = {
        symbol: contract.symbol,
        token: contract.token,
        exchange: contract.exchange,
        expiry: contract.expiry,
        contractName: contract.contractName,
      };
      this.contractCache.set(symbol, resolved);
      this.unresolvedSymbols.delete(symbol);
      return resolved;
    } catch (error: unknown) {
      if (!this.unresolvedSymbols.has(symbol)) {
        const message = error instanceof Error ? error.message : "Unknown contract resolution error";
        mcxLogger.warn("SIMULATED_FEED_CONTRACT_PENDING", { symbol, error: message });
        this.unresolvedSymbols.add(symbol);
      }
      return null;
    }
  }

  private static roundToTick(price: number, tickSize: number): number {
    if (!Number.isFinite(tickSize) || tickSize <= 0) {
      return Number(price.toFixed(2));
    }
    const scaled = Math.round(price / tickSize) * tickSize;
    return Number(scaled.toFixed(4));
  }
}
