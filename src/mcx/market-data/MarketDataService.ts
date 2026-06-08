import type { McxInstrument } from "@prisma/client";
import prisma from "@/lib/prisma";
import { mcxConfig, getMCXSymbolConfig } from "../config/mcx.config";
import { MCXEventBus, MCXEventType } from "../events/EventBus";
import type { NormalizedMCXTick } from "../types";
import { mcxLogger } from "../utils/logger";

type AngelInstrument = Record<string, string | number | null | undefined>;

function parseExpiry(value: unknown): Date | null {
  if (!value) return null;
  const raw = String(value).trim();
  const direct = new Date(raw);
  if (!Number.isNaN(direct.getTime())) return direct;
  const match = raw.match(/^(\d{1,2})([A-Z]{3})(\d{2,4})$/i);
  if (!match) return null;
  const [, day, mon, year] = match;
  const parsed = new Date(`${day} ${mon} ${year.length === 2 ? `20${year}` : year} 23:59:59 GMT+0530`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeBaseSymbol(record: AngelInstrument): string {
  const name = String(record.name || record.symbol || record.tradingsymbol || "").toUpperCase();
  const configured = mcxConfig.marketData.symbols.find((symbol) => name.startsWith(symbol));
  return configured || name.replace(/[^A-Z]/g, "");
}

function isFuturesInstrument(instrumentType: string, contractName: string): boolean {
  const isFutureType = /^FUT/i.test(instrumentType) && !/^OPT/i.test(instrumentType);
  const isFutureContract = /FUT$/i.test(contractName) && !/(CE|PE)$/i.test(contractName);
  return isFutureType && isFutureContract;
}

function preferredContractPattern(symbol: string): RegExp {
  switch (symbol.toUpperCase()) {
    case "GOLD":
      return /^GOLD\d{1,2}[A-Z]{3}\d{2}FUT$/i;
    case "SILVER":
      return /^SILVER\d{1,2}[A-Z]{3}\d{2}FUT$/i;
    case "CRUDEOIL":
      return /^CRUDEOIL\d{1,2}[A-Z]{3}\d{2}FUT$/i;
    case "NATURALGAS":
      return /^NATURALGAS\d{1,2}[A-Z]{3}\d{2}FUT$/i;
    case "COPPER":
      return /^COPPER\d{1,2}[A-Z]{3}\d{2}FUT$/i;
    default:
      return /.*/;
  }
}

function fallbackReferencePrice(symbol: string): number {
  const map: Record<string, number> = {
    GOLD: 155_710,
    SILVER: 106_200,
    CRUDEOIL: 6_400,
    NATURALGAS: 250,
    COPPER: 890,
  };
  return map[symbol.toUpperCase()] ?? 1000;
}

export class MarketDataService {
  private static initialized = false;
  private static tickStore = new Map<string, NormalizedMCXTick>();
  private static contractCache = new Map<string, McxInstrument>();

  static initialize() {
    if (this.initialized) return;
    this.initialized = true;
    void this.syncAngelOneInstrumentMaster().catch((error) => {
      mcxLogger.warn("INSTRUMENT_SYNC_FAILED", { error: error.message });
    });
    mcxLogger.info("MarketDataService Initialized", { symbols: mcxConfig.marketData.symbols });
  }

  static async syncAngelOneInstrumentMaster(): Promise<number> {
    const lastSync = await prisma.mcxInstrument.findFirst({
      orderBy: { syncedAt: "desc" },
      select: { syncedAt: true },
    });

    const now = new Date();
    // Skip if synced in the last 12 hours
    if (lastSync && now.getTime() - lastSync.syncedAt.getTime() < 12 * 60 * 60 * 1000) {
      mcxLogger.info("Skipping instrument sync, recently updated", { lastSync: lastSync.syncedAt });
      // Even if skipping sync, we should clear cache to ensure fresh resolution if needed, 
      // but better to keep it and let it be populated as symbols are requested.
      return 0;
    }

    mcxLogger.info("Starting Angel One instrument sync...");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout

    try {
      const response = await fetch(mcxConfig.marketData.instrumentMasterUrl, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Angel instrument sync failed: ${response.status}`);
      const records = (await response.json()) as AngelInstrument[];
      clearTimeout(timeout);

      let count = 0;
      const toUpsert = [];

      for (const record of records) {
        const exchange = String(record.exch_seg || record.exchange || "").toUpperCase();
        const instrumentType = String(record.instrumenttype || record.instrument_type || "").toUpperCase();
        const contractName = String(record.symbol || record.tradingsymbol || record.name || "").trim();
        if (exchange !== mcxConfig.marketData.exchange || !isFuturesInstrument(instrumentType, contractName)) continue;
        const symbol = normalizeBaseSymbol(record);
        if (!mcxConfig.marketData.symbols.includes(symbol)) continue;
        const expiry = parseExpiry(record.expiry);
        const token = String(record.token || record.symboltoken || "").trim();
        if (!expiry || !token || !contractName) continue;

        toUpsert.push({
          symbol,
          token,
          exchange,
          expiry,
          contractName,
          instrumentType,
          record,
        });
      }

      mcxLogger.info(`Processing ${toUpsert.length} instruments...`);

      // Batch upserts to avoid saturating connection pool
      for (let i = 0; i < toUpsert.length; i += 50) {
        const batch = toUpsert.slice(i, i + 50);
        await Promise.all(
          batch.map(async (item) => {
            const symbolCfg = getMCXSymbolConfig(item.symbol);
            return prisma.mcxInstrument.upsert({
              where: {
                symbol_exchange_expiry_contractName: {
                  symbol: item.symbol,
                  exchange: item.exchange,
                  expiry: item.expiry,
                  contractName: item.contractName,
                },
              },
              create: {
                symbol: item.symbol,
                token: item.token,
                exchange: item.exchange,
                expiry: item.expiry,
                contractName: item.contractName,
                instrumentType: item.instrumentType,
                lotSize: Number(item.record.lotsize || item.record.lot_size || symbolCfg.lotSize),
                tickSize: Number(item.record.tick_size || item.record.tickSize || symbolCfg.tickSize),
                raw: item.record as Record<string, unknown>,
                active: item.expiry >= now,
                syncedAt: now,
              },
              update: {
                token: item.token,
                instrumentType: item.instrumentType,
                lotSize: Number(item.record.lotsize || item.record.lot_size || symbolCfg.lotSize),
                tickSize: Number(item.record.tick_size || item.record.tickSize || symbolCfg.tickSize),
                raw: item.record as Record<string, unknown>,
                active: item.expiry >= now,
                syncedAt: now,
              },
            });
          })
        );
        count += batch.length;
      }

      // Clear contract cache after sync to ensure new contracts are picked up
      this.contractCache.clear();
      mcxLogger.info("INSTRUMENT_SYNCED", { count });
      return count;
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Angel instrument sync timed out after 60s");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  static async resolveContract(symbol: string, at = new Date()): Promise<McxInstrument> {
    const normalized = symbol.toUpperCase();
    
    // Check Cache First
    const cached = this.contractCache.get(normalized);
    if (cached && cached.expiry >= at) return cached;

    const contracts = await prisma.mcxInstrument.findMany({
      where: { symbol: normalized, exchange: mcxConfig.marketData.exchange, active: true, expiry: { gte: at } },
      orderBy: [{ expiry: "asc" }, { createdAt: "desc" }],
      take: 200,
    });
    const futuresOnly = contracts.filter((item) =>
      isFuturesInstrument(String(item.instrumentType || ""), String(item.contractName || ""))
    );
    const preferredPattern = preferredContractPattern(normalized);
    const preferred = futuresOnly.find((item) => preferredPattern.test(item.contractName));
    const contract = preferred || futuresOnly[0] || null;
    if (!contract) {
      MCXEventBus.publish(MCXEventType.CONTRACT_MISMATCH, { symbol: normalized, reason: "NO_ACTIVE_CONTRACT" });
      throw new Error(`No active MCX contract found for ${normalized}`);
    }

    // Update Cache
    this.contractCache.set(normalized, contract);
    return contract;
  }

  static async normalizeTick(input: { symbol?: string; token?: string; price: number; volume?: number; timestamp?: number | Date; raw?: unknown }): Promise<NormalizedMCXTick> {
    if (!Number.isFinite(input.price) || input.price <= 0) throw new Error("Invalid MCX tick price");
    
    let contract: McxInstrument | null = null;
    
    // Resolve contract via centralized logic
    if (input.token) {
      // Try to find in cache by token first? No, resolveContract handles by symbol. 
      // If we have token, we can lookup in DB or we should have a token-based cache too.
      contract = await prisma.mcxInstrument.findFirst({ 
        where: { token: String(input.token), exchange: mcxConfig.marketData.exchange, active: true } 
      });
    }
    
    if (!contract && input.symbol) {
      contract = await this.resolveContract(input.symbol);
    }
    
    if (!contract) throw new Error("MCX tick cannot be mapped to a contract");
    
    const timestamp = input.timestamp instanceof Date ? input.timestamp : new Date(input.timestamp || Date.now());
    return {
      symbol: contract.symbol,
      token: contract.token,
      exchange: contract.exchange,
      expiry: contract.expiry,
      contractName: contract.contractName,
      price: input.price,
      volume: Number(input.volume || 0),
      timestamp,
      raw: input.raw,
    };
  }

  static async ingestTick(input: { symbol?: string; token?: string; price: number; volume?: number; timestamp?: number | Date; raw?: unknown }) {
    const tick = await this.normalizeTick(input);
    
    // STEP 4: Update In-Memory Store BEFORE anything else
    this.tickStore.set(tick.symbol, tick);

    // Persist to DB asynchronously
    void prisma.mcxTick.create({ data: { ...tick, raw: tick.raw as object | undefined } }).catch(err => {
      mcxLogger.warn("TICK_PERSIST_FAILED", { symbol: tick.symbol, error: err.message });
    });

    // Publish event
    MCXEventBus.publish(MCXEventType.PRICE_TICK, { 
      ...tick, 
      timestamp: tick.timestamp.toISOString(), 
      expiry: tick.expiry.toISOString() 
    });

    return tick;
  }

  static async latestTick(symbol: string, token?: string) {
    const normalized = symbol.toUpperCase();
    
    // Priority 1: In-Memory Store
    const cached = this.tickStore.get(normalized);
    if (cached && (!token || cached.token === token)) return cached;

    // Priority 2: Database Fallback
    return prisma.mcxTick.findFirst({
      where: {
        symbol: normalized,
        ...(token ? { token } : {}),
      },
      orderBy: { timestamp: "desc" },
    });
  }

  static async latestPrice(symbol: string): Promise<number | null> {
    const contract = await this.resolveContract(symbol).catch(() => null);
    const tick = await this.latestTick(symbol, contract?.token);
    return tick?.price ?? null;
  }

  static referencePrice(symbol: string): number {
    return fallbackReferencePrice(symbol);
  }
}
