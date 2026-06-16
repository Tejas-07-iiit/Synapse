import prisma from "@/lib/prisma";
import { IndicatorEngine } from "../indicators/IndicatorEngine";
import { WalletService } from "../wallet/WalletService";
import { CandleBuilder } from "../candles/CandleBuilder";
import { MarketDataService } from "../market-data/MarketDataService";
import type { MCXInterval } from "../config/mcx.config";

export class PortfolioService {
  static async dashboard(userId: string, symbol: string) {
    const normalized = symbol.toUpperCase();
    const contract = await MarketDataService.resolveContract(normalized).catch(() => null);
    const [wallet, tick, positions] = await Promise.all([
      WalletService.getWallet(userId),
      MarketDataService.latestTick(normalized, contract?.token),
      prisma.mcxPosition.findMany({ where: { userId, status: "OPEN" } }),
    ]);
    return {
      wallet,
      livePrice: tick?.price ?? MarketDataService.referencePrice(normalized),
      contractName: contract?.contractName ?? null,
      token: contract?.token ?? null,
      positions,
      engineEnabled: !wallet.tradingHalted,
    };
  }

  static async portfolio(userId: string) {
    const [wallet, openPositions, closedTrades] = await Promise.all([
      WalletService.getWallet(userId),
      prisma.mcxPosition.findMany({ where: { userId, status: "OPEN" }, orderBy: { openedAt: "desc" } }),
      prisma.mcxTrade.findMany({ where: { userId, type: "EXIT" }, orderBy: { createdAt: "desc" }, take: 500 }),
    ]);
    const winningTrades = closedTrades.filter((trade) => trade.profit > 0).length;
    const losingTrades = closedTrades.filter((trade) => trade.profit < 0).length;
    const commodityExposure = openPositions.map((position) => ({
      symbol: position.symbol,
      openLots: position.lots,
      marginUsed: position.marginUsed,
      exposureValue: position.currentPrice * position.quantity,
    }));
    return {
      wallet,
      openPositions: openPositions.map((position) => ({
        id: position.id,
        symbol: position.symbol,
        direction: position.side,
        lots: position.lots,
        entryPrice: position.entryPrice,
        currentPrice: position.currentPrice,
        marginUsed: position.marginUsed,
        unrealizedPnL: position.unrealizedPnL,
        status: position.status,
        stopLoss: position.stopLoss,
        takeProfit: position.takeProfit,
      })),
      closedStats: {
        totalTrades: closedTrades.length,
        winningTrades,
        losingTrades,
        winRate: closedTrades.length ? (winningTrades / closedTrades.length) * 100 : 0,
      },
      commodityExposure,
    };
  }

  static async trades(userId: string) {
    return prisma.mcxTrade.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50 });
  }

  static async chart(symbol: string, interval = "15m") {
    const sym = symbol.toUpperCase();
    const contract = await MarketDataService.resolveContract(sym).catch(() => null);
    
    // STRICT: Only fetch candles for the currently active contract
    // If no contract is resolved, we force an empty list to avoid leaking old data
    const preferredCandles = await prisma.mcxCandle.findMany({
      where: {
        symbol: sym,
        interval,
        isClosed: true,
        ...(contract?.token ? { token: contract.token } : {}),
      },
      orderBy: { timestamp: "desc" },
      take: 300,
    });

    const candles = preferredCandles.length
      ? preferredCandles
      : await prisma.mcxCandle.findMany({
          where: {
            symbol: sym,
            interval,
            isClosed: true,
          },
          orderBy: { timestamp: "desc" },
          take: 300,
        });

    const list = candles.reverse();

    // Check for active candle
    if (contract) {
      let active = CandleBuilder.getActiveCandle(sym, contract.token, interval as MCXInterval);
      
      if (!active) {
        // Fallback: Check DB for latest unclosed candle (daemon might have persisted it)
        const unclosed = await prisma.mcxCandle.findFirst({
          where: {
            symbol: sym,
            token: contract.token,
            interval,
            isClosed: false,
          },
          orderBy: { timestamp: "desc" },
        });
        if (unclosed) active = unclosed as any;
      }

      if (active) {
        // Ensure active candle matches single source of truth
        const latestPrice = await MarketDataService.latestPrice(sym);
        if (latestPrice) {
          active.close = latestPrice;
          active.high = Math.max(active.high, latestPrice);
          active.low = Math.min(active.low, latestPrice);
        }
        list.push(active as typeof candles[number]);
      }
    }

    return IndicatorEngine.alignChart(list);
  }

  static async indicators(symbol: string) {
    const normalized = symbol.toUpperCase();
    const contract = await MarketDataService.resolveContract(normalized).catch(() => null);
    const preferredCandles = await prisma.mcxCandle.findMany({
      where: {
        symbol: normalized,
        interval: "15m",
        isClosed: true,
        ...(contract?.token ? { token: contract.token } : {}),
      },
      orderBy: { timestamp: "desc" },
      take: 240,
    });
    const candles = preferredCandles.length
      ? preferredCandles
      : await prisma.mcxCandle.findMany({
          where: { symbol: normalized, interval: "15m", isClosed: true },
          orderBy: { timestamp: "desc" },
          take: 240,
        });
    return IndicatorEngine.calculate(candles.reverse());
  }
}
