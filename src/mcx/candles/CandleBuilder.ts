import prisma from "@/lib/prisma";
import { mcxConfig, type MCXInterval } from "../config/mcx.config";
import { MCXEventBus, MCXEventType } from "../events/EventBus";
import type { MCXCandleData, NormalizedMCXTick } from "../types";
import { mcxLogger } from "../utils/logger";

const intervalMs: Record<MCXInterval, number> = { "1m": 60_000, "5m": 300_000, "15m": 900_000 };

export class CandleBuilder {
  private static activeCandles = new Map<string, MCXCandleData>();
  private static initialized = false;

  static initialize() {
    if (this.initialized) return;
    this.initialized = true;
    MCXEventBus.on(MCXEventType.PRICE_TICK, (payload) => {
      const raw = payload as Record<string, unknown>;
      void this.processTick({ ...raw, timestamp: new Date(String(raw.timestamp)), expiry: new Date(String(raw.expiry)) } as unknown as NormalizedMCXTick);
    });
    mcxLogger.info("CandleBuilder Initialized", { intervals: mcxConfig.marketData.intervals });
  }

  static async processTick(tick: NormalizedMCXTick) {
    for (const interval of mcxConfig.marketData.intervals) await this.processInterval(tick, interval);
  }

  private static async processInterval(tick: NormalizedMCXTick, interval: MCXInterval) {
    const start = new Date(Math.floor(tick.timestamp.getTime() / intervalMs[interval]) * intervalMs[interval]);
    const key = `${tick.symbol}:${tick.token}:${interval}`;
    const active = this.activeCandles.get(key);

    if (active && active.timestamp.getTime() !== start.getTime()) {
      active.isClosed = true;
      await prisma.mcxCandle.upsert({
        where: { symbol_interval_timestamp: { symbol: active.symbol, interval: active.interval, timestamp: active.timestamp } },
        create: active,
        update: active,
      });
      MCXEventBus.publish(MCXEventType.CANDLE_CLOSED, { ...active, timestamp: active.timestamp.toISOString(), expiry: active.expiry.toISOString() });
      this.activeCandles.delete(key);
    }

    const current = this.activeCandles.get(key);
    if (!current) {
      this.activeCandles.set(key, {
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
      });
      return;
    }
    current.high = Math.max(current.high, tick.price);
    current.low = Math.min(current.low, tick.price);
    current.close = tick.price;
    current.volume += tick.volume;
  }

  static getActiveCandle(symbol: string, token: string, interval: MCXInterval): MCXCandleData | null {
    return this.activeCandles.get(`${symbol}:${token}:${interval}`) || null;
  }
}
