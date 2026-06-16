import prisma from "@/lib/prisma";
import { mcxConfig, type MCXInterval } from "../config/mcx.config";
import { MCXEventBus, MCXEventType } from "../events/EventBus";
import type { MCXCandleData, NormalizedMCXTick } from "../types";
import { mcxLogger } from "../utils/logger";

const intervalMs: Record<MCXInterval, number> = { "1m": 60_000, "5m": 300_000, "15m": 900_000 };

export class CandleBuilder {
  private static activeCandles = new Map<string, MCXCandleData>();
  private static initialized = false;
  private static flushInterval: NodeJS.Timeout | null = null;

  static initialize() {
    if (this.initialized) return;
    this.initialized = true;
    MCXEventBus.on(MCXEventType.PRICE_TICK, (payload) => {
      const raw = payload as Record<string, unknown>;
      void this.processTick({ ...raw, timestamp: new Date(String(raw.timestamp)), expiry: new Date(String(raw.expiry)) } as unknown as NormalizedMCXTick);
    });
    
    // Periodically flush stale candles (ones whose interval has passed)
    this.flushInterval = setInterval(() => void this.flushStaleCandles(), 30000); // Check every 30s
    
    mcxLogger.info("CandleBuilder Initialized", { intervals: mcxConfig.marketData.intervals });
  }

  static async flushStaleCandles() {
    const now = new Date();
    for (const [key, active] of this.activeCandles.entries()) {
      const interval = active.interval as MCXInterval;
      const endTime = new Date(active.timestamp.getTime() + intervalMs[interval]);
      
      if (now >= endTime) {
        mcxLogger.info("Flushing stale candle", { symbol: active.symbol, interval: active.interval, timestamp: active.timestamp });
        active.isClosed = true;
        await this.persistCandle(active);
        this.activeCandles.delete(key);
      } else {
        // Even if not stale, persist as unclosed so the web UI can see the latest price
        await this.persistCandle({ ...active, isClosed: false });
      }
    }
  }

  static async shutdown() {
    if (this.flushInterval) clearInterval(this.flushInterval);
    mcxLogger.info("CandleBuilder shutting down, flushing all active candles...");
    for (const [key, active] of this.activeCandles.entries()) {
      active.isClosed = true;
      await this.persistCandle(active);
    }
    this.activeCandles.clear();
  }

  private static async persistCandle(candle: MCXCandleData) {
    try {
      await prisma.mcxCandle.upsert({
        where: { symbol_interval_timestamp: { symbol: candle.symbol, interval: candle.interval, timestamp: candle.timestamp } },
        create: candle,
        update: candle,
      });
    } catch (err: any) {
      mcxLogger.warn("CANDLE_PERSIST_FAILED", { symbol: candle.symbol, error: err.message });
    }
  }

  static async processTick(tick: NormalizedMCXTick) {
    for (const interval of mcxConfig.marketData.intervals) await this.processInterval(tick, interval);
  }

  private static async processInterval(tick: NormalizedMCXTick, interval: MCXInterval) {
    const start = new Date(Math.floor(tick.timestamp.getTime() / intervalMs[interval]) * intervalMs[interval]);
    const key = `${tick.symbol}:${tick.token}:${interval}`;
    
    // Detect contract switch for the same symbol
    for (const [activeKey, active] of this.activeCandles.entries()) {
      if (active.symbol === tick.symbol && active.token !== tick.token && active.interval === interval) {
        mcxLogger.info("Contract switch detected, closing old candle", { 
          symbol: tick.symbol, 
          oldToken: active.token, 
          newToken: tick.token 
        });
        active.isClosed = true;
        await this.persistCandle(active);
        MCXEventBus.publish(MCXEventType.CANDLE_CLOSED, { ...active, timestamp: active.timestamp.toISOString(), expiry: active.expiry.toISOString() });
        this.activeCandles.delete(activeKey);
      }
    }

    const active = this.activeCandles.get(key);

    if (active && active.timestamp.getTime() !== start.getTime()) {
      active.isClosed = true;
      await this.persistCandle(active);
      MCXEventBus.publish(MCXEventType.CANDLE_CLOSED, { ...active, timestamp: active.timestamp.toISOString(), expiry: active.expiry.toISOString() });
      this.activeCandles.delete(key);
    }

    let current = this.activeCandles.get(key);
    if (!current) {
      current = {
        symbol: tick.symbol,
        token: tick.token,
        exchange: tick.exchange,
        expiry: tick.expiry,
        contractName: tick.contractName,
        interval,
        open: tick.price,
        high: tick.price,
        low: tick.price,
        close: tick.price,
        volume: tick.volume,
        timestamp: start,
        isClosed: false,
      };
      this.activeCandles.set(key, current);
    } else {
      current.high = Math.max(current.high, tick.price);
      current.low = Math.min(current.low, tick.price);
      current.close = tick.price;
      current.volume += tick.volume;
    }
    
    // Optional: persist on every tick? Better to rely on the 30s flush for unclosed candles
    // to avoid excessive DB writes, but we can do it for 1m intervals if needed.
  }

  static getActiveCandle(symbol: string, token: string, interval: MCXInterval): MCXCandleData | null {
    return this.activeCandles.get(`${symbol}:${token}:${interval}`) || null;
  }
}
