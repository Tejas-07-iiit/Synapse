import { mcxConfig } from "../config/mcx.config";
import { MCXEventBus, MCXEventType } from "../events/EventBus";
import { MarketDataService } from "../market-data/MarketDataService";
import { CandleBuilder } from "../candles/CandleBuilder";
import { mcxLogger } from "../utils/logger";

export class PriceIntegrityGuard {
  private static interval: NodeJS.Timeout | null = null;

  static start() {
    if (this.interval) return;
    this.interval = setInterval(() => void this.checkIntegrity(), 10000); // Every 10s
    mcxLogger.info("PriceIntegrityGuard Started");
  }

  static stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private static async checkIntegrity() {
    for (const symbol of mcxConfig.marketData.symbols) {
      try {
        const contract = await MarketDataService.resolveContract(symbol).catch(() => null);
        if (!contract) continue;

        const latestTick = await MarketDataService.latestTick(symbol, contract.token);
        const activeCandle = CandleBuilder.getActiveCandle(symbol, contract.token, "1m");

        if (!latestTick || !activeCandle) continue;

        const diff = Math.abs(latestTick.price - activeCandle.close);
        const threshold = latestTick.price * 0.001; // 0.1%

        if (diff > threshold) {
          mcxLogger.error("PRICE_MISMATCH_DETECTED", {
            symbol,
            contract: contract.contractName,
            token: contract.token,
            tickPrice: latestTick.price,
            candlePrice: activeCandle.close,
            difference: diff,
          });

          MCXEventBus.publish(MCXEventType.PRICE_MISMATCH, {
            symbol,
            source: "PriceIntegrityGuard",
            mismatches: [
              {
                left: { name: "latestTick", price: latestTick.price },
                right: { name: "activeCandle", price: activeCandle.close },
                differencePct: (diff / latestTick.price) * 100,
              },
            ],
          });
        }
      } catch (error: any) {
        mcxLogger.warn("PriceIntegrityGuard check failed for symbol", { symbol, error: error.message });
      }
    }
  }
}
