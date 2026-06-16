import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { bootstrapMCX } from "@/src/mcx/bootstrap";
import { PriceIntegrityValidator } from "@/src/mcx/analytics/PriceIntegrityValidator";
import { mcxConfig } from "@/src/mcx/config/mcx.config";
import { MarketDataService } from "@/src/mcx/market-data/MarketDataService";
import { PortfolioService } from "@/src/mcx/services/PortfolioService";
import prisma from "@/lib/prisma";

const JWT_SECRET = process.env.JWT_SECRET || "developmentsupersecretkey123456789012345";

async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value || cookieStore.get("mcx_token")?.value;
  if (!token) return null;
  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch {
    return null;
  }
}

async function handleInternal(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    await bootstrapMCX({ mode: "web" });
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const userId = String(user.id);
    const { path = [] } = await params;
    const [section, subSection, asset] = path;

    if (section === "mcx" && subSection === "live-price") {
      const symbol = (asset || "GOLD").toUpperCase();
      const contract = await MarketDataService.resolveContract(symbol).catch(() => null);
      const tick = await MarketDataService.latestTick(symbol, contract?.token);
      const fallbackCandle = tick
        ? null
        : await prisma.mcxCandle.findFirst({
            where: {
              symbol,
              interval: "15m",
              isClosed: true,
              ...(contract?.token ? { token: contract.token } : {}),
            },
            orderBy: { timestamp: "desc" },
          });
      const integrity = await PriceIntegrityValidator.validate(symbol);
      const fallbackPrice = fallbackCandle?.close ?? MarketDataService.referencePrice(symbol);
      return NextResponse.json({
        success: true,
        price: tick?.price ?? fallbackPrice,
        symbol,
        token: tick?.token ?? fallbackCandle?.token ?? null,
        exchange: tick?.exchange ?? fallbackCandle?.exchange ?? mcxConfig.marketData.exchange,
        expiry: tick?.expiry ?? fallbackCandle?.expiry ?? null,
        contractName: tick?.contractName ?? fallbackCandle?.contractName ?? null,
        timestamp: tick?.timestamp ?? fallbackCandle?.timestamp ?? null,
        integrity,
      });
    }

    if (section === "chart") {
      const symbol = (subSection || "GOLD").toUpperCase();
      const interval = path[2] || "15m";
      const data = await PortfolioService.chart(symbol, interval);
      return NextResponse.json({ success: true, data });
    }

    if (section === "dashboard") {
      const symbol = (subSection || "GOLD").toUpperCase();
      const data = await PortfolioService.dashboard(userId, symbol);
      return NextResponse.json({ success: true, ...data });
    }

    if (section === "portfolio") {
      const data = await PortfolioService.portfolio(userId);
      return NextResponse.json({
        success: true,
        ...data,
        availableBalance: data.wallet.availableBalance,
        realTotalProfit: data.wallet.realizedPnL,
        equity: data.wallet.equity,
      });
    }

    if (section === "signals") {
      const logs = await prisma.mcxEventLog.findMany({
        where: { type: "SIGNAL_GENERATED" },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      const signals = logs.map(log => {
        const payload = log.payload as any;
        return {
          id: log.id,
          symbol: payload.symbol,
          direction: payload.direction,
          confidence: payload.confidence,
          strategyId: payload.strategyId,
          strategyName: payload.strategyName,
          timeframe: payload.timeframe,
          entryPrice: payload.entryPrice,
          stopLoss: payload.stopLoss,
          takeProfit: payload.takeProfit,
          timestamp: log.createdAt.toISOString(),
        };
      });
      return NextResponse.json({ success: true, signals });
    }

    if (section === "wallet") {
      const data = await PortfolioService.portfolio(userId);
      return NextResponse.json({ success: true, wallet: data.wallet });
    }

    if (section === "positions") {
      const data = await PortfolioService.portfolio(userId);
      return NextResponse.json({ success: true, data: data.openPositions });
    }

    if (section === "trades") {
      const data = await PortfolioService.trades(userId);
      return NextResponse.json({ success: true, data });
    }

    if (section === "trade" && subSection === "history") {
      const data = await PortfolioService.trades(userId);
      return NextResponse.json({ success: true, data });
    }

    if ((section === "engine" || section === "bot") && subSection === "state") {
      const portfolio = await PortfolioService.portfolio(userId);
      return NextResponse.json({
        success: true,
        engineEnabled: !portfolio.wallet.tradingHalted,
        botEnabled: !portfolio.wallet.tradingHalted,
        availableBalance: portfolio.wallet.availableBalance,
        realTotalProfit: portfolio.wallet.realizedPnL,
        states: mcxConfig.marketData.symbols.map((symbol) => {
          const position = portfolio.openPositions.find((item) => item.symbol === symbol);
          return {
            commodity: symbol,
            availableBalance: portfolio.wallet.availableBalance,
            holdings: position?.lots || 0,
            averageBuyPrice: position?.entryPrice || 0,
            realTotalProfit: portfolio.wallet.realizedPnL,
            currentStrategy: position ? "Active" : "None",
            marketType: "MCX FUTCOM",
            engineMode: portfolio.wallet.tradingHalted ? "Risk Locked" : "Automatic",
            lastAction: position ? position.direction : "HOLD",
            nextAnalysisTime: null,
            warningMessage: portfolio.wallet.haltReason || undefined,
          };
        }),
      });
    }

    if ((section === "engine" || section === "bot") && (subSection === "enable" || subSection === "disable")) {
      const isHalted = subSection === "disable"; await prisma.mcxWallet.updateMany({ where: { userId }, data: { tradingHalted: isHalted, haltReason: isHalted ? "USER_DISABLED" : null } }); return NextResponse.json({ success: true, engineEnabled: !isHalted, botEnabled: !isHalted });
    }

    if (section === "mcx" && subSection === "indicators") {
      const symbol = (asset || "GOLD").toUpperCase();
      const indicators = await PortfolioService.indicators(symbol);
      return NextResponse.json({ success: true, ...indicators });
    }

    if (section === "mcx" && subSection === "market-condition") {
      const symbol = (asset || "GOLD").toUpperCase();
      const indicators = await PortfolioService.indicators(symbol);
      const condition = indicators.adx && indicators.adx > 25 ? "Trending" : "Ranging";
      return NextResponse.json({ success: true, condition, strength: indicators.adx ?? 0, indicators });
    }

    if (section === "contracts") {
      const contracts = await Promise.all(mcxConfig.marketData.symbols.map((symbol) => MarketDataService.resolveContract(symbol).catch(() => null)));
      return NextResponse.json({ success: true, data: contracts.filter(Boolean) });
    }

    return NextResponse.json({ error: "Endpoint not implemented locally", path: path.join("/") }, { status: 404 });
  } catch (error: unknown) {
    console.error("[MCX Internal API Error]:", error);
    const message = error instanceof Error ? error.message : "Unexpected MCX API error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export { handleInternal as GET, handleInternal as POST, handleInternal as PUT, handleInternal as DELETE, handleInternal as PATCH };
