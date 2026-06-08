import prisma from "@/lib/prisma";
import { mcxConfig } from "../config/mcx.config";
import { MCXEventBus, MCXEventType } from "../events/EventBus";
import { MarketDataService } from "../market-data/MarketDataService";

function pctDiff(a: number, b: number): number {
  if (a === 0 && b === 0) return 0;
  return (Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b))) * 100;
}

export class PriceIntegrityValidator {
  static async validate(symbol: string) {
    const normalized = symbol.toUpperCase();
    const contract = await MarketDataService.resolveContract(normalized).catch(() => null);
    const [tick, candle] = await Promise.all([
      MarketDataService.latestTick(normalized, contract?.token),
      prisma.mcxCandle.findFirst({
        where: {
          symbol: normalized,
          interval: "1m",
          isClosed: true,
          ...(contract?.token ? { token: contract.token } : {}),
        },
        orderBy: { timestamp: "desc" },
      }),
    ]);
    const chartPrice = candle?.close ?? null;
    const dashboardPrice = tick?.price ?? chartPrice;
    const checks = [
      { name: "latestTick", price: tick?.price ?? null },
      { name: "latestCandle", price: candle?.close ?? null },
      { name: "chart", price: chartPrice },
      { name: "dashboard", price: dashboardPrice },
    ];
    const prices = checks.filter((item): item is { name: string; price: number } => item.price != null);
    const mismatches = [];
    for (const left of prices) {
      for (const right of prices) {
        if (left.name === right.name) continue;
        const differencePct = pctDiff(left.price, right.price);
        if (differencePct > mcxConfig.marketData.priceMismatchTolerancePct) mismatches.push({ left, right, differencePct });
      }
    }
    if (mismatches.length) MCXEventBus.publish(MCXEventType.PRICE_MISMATCH, { symbol: normalized, mismatches });
    return { symbol: normalized, ok: mismatches.length === 0, checks, mismatches };
  }
}
