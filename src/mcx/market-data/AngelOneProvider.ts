import { SmartAPI, WebSocketV2 } from "smartapi-javascript";
import { authenticator } from "otplib";
import { mcxConfig } from "../config/mcx.config";
import { mcxLogger } from "../utils/logger";
import { MarketDataService } from "./MarketDataService";
import { SimulatedMarketDataProvider } from "./SimulatedMarketDataProvider";
import prisma from "@/lib/prisma";

export class AngelOneProvider {
  private static smartApi: any = null;
  private static ws: any = null;
  private static initialized = false;

  static async initialize() {
    if (this.initialized) return;
    this.initialized = true;

    mcxLogger.info("AngelOneProvider: Starting initialization...");
    if (!this.hasCredentials()) {
      mcxLogger.warn("AngelOneProvider: Missing credentials, starting simulated market feed fallback.");
      SimulatedMarketDataProvider.start("missing_angel_credentials");
      return;
    }

    try {
      await this.login();
      mcxLogger.info("AngelOneProvider: Login successful, starting backfill...");
      await this.backfillAll();
      mcxLogger.info("AngelOneProvider: Backfill complete, connecting WebSocket...");
      await this.connectWebSocket();
      SimulatedMarketDataProvider.stop();
      mcxLogger.info("AngelOneProvider Initialized successfully");
    } catch (error: any) {
      mcxLogger.error("AngelOneProvider Initialization Failed", { error: error.message, stack: error.stack });
      SimulatedMarketDataProvider.start("angel_provider_initialization_failed");
      this.initialized = false;
      // Retry after 30s
      setTimeout(() => this.initialize(), 30000);
    }
  }

  private static hasCredentials(): boolean {
    const { apiKey, clientId, password, totpSecret } = mcxConfig.marketData.credentials;
    return Boolean(apiKey && clientId && password && totpSecret);
  }

  private static async backfillAll() {
    mcxLogger.info("Starting historical data backfill...");
    const to = new Date();
    const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days back

    for (const symbol of mcxConfig.marketData.symbols) {
      for (const interval of mcxConfig.marketData.intervals) {
        try {
          const candles = await this.fetchHistoricalCandles(symbol, interval, from, to);
          if (candles && candles.length > 0) {
            const contract = await MarketDataService.resolveContract(symbol);
            const formatted = candles.map((c: any) => ({
              symbol,
              token: contract.token,
              exchange: contract.exchange,
              expiry: contract.expiry,
              contractName: contract.contractName,
              interval,
              timestamp: new Date(c[0]),
              open: Number(c[1]),
              high: Number(c[2]),
              low: Number(c[3]),
              close: Number(c[4]),
              volume: Number(c[5]),
              isClosed: true,
            }));

            // Use upsert in a loop or a more efficient way if supported
            for (const candle of formatted) {
              await prisma.mcxCandle.upsert({
                where: { symbol_interval_timestamp: { symbol: candle.symbol, interval: candle.interval, timestamp: candle.timestamp } },
                create: candle,
                update: candle,
              });
            }
            mcxLogger.info("Backfilled historical candles", { symbol, interval, count: candles.length });
          }
        } catch (error: any) {
          mcxLogger.warn("Backfill failed for symbol/interval", { symbol, interval, error: error.message });
        }
      }
    }
  }

  private static async login() {
    const { apiKey, clientId, password, totpSecret } = mcxConfig.marketData.credentials;
    mcxLogger.info("AngelOneProvider: Attempting login...", { clientId, apiKey: apiKey ? "***" : "MISSING" });
    
    if (!apiKey || !clientId || !password || !totpSecret) {
      throw new Error("Missing Angel One credentials in configuration. Check your .env file.");
    }

    try {
      const totp = authenticator.generate(totpSecret);
      mcxLogger.info("AngelOneProvider: Generated TOTP");
      this.smartApi = new SmartAPI({ api_key: apiKey });

      const session = await this.smartApi.generateSession(clientId, password, totp);
      if (!session.status) {
        mcxLogger.error("Angel One login status false", { message: session.message });
        throw new Error(`Angel One login failed: ${session.message}`);
      }

      mcxLogger.info("Angel One Login Successful", { clientId });
      return session.data;
    } catch (err: any) {
      mcxLogger.error("Angel One login exception", { error: err.message });
      throw err;
    }
  }

  private static async connectWebSocket() {
    const { apiKey, clientId } = mcxConfig.marketData.credentials;
    const sessionData = this.smartApi.getSessionToken();
    const feedToken = sessionData.feedToken;

    this.ws = new WebSocketV2({
      api_key: apiKey,
      client_code: clientId,
      feed_token: feedToken,
      jwt_token: sessionData.jwtToken,
    });

    this.ws.connect();

    this.ws.on("connect", () => {
      mcxLogger.info("Angel One WebSocket Connected");
      this.subscribe();
    });

    this.ws.on("tick", (tick: any) => {
      this.handleTick(tick);
    });

    this.ws.on("error", (error: any) => {
      mcxLogger.error("Angel One WebSocket Error", { error: error.message });
    });

    this.ws.on("close", () => {
      mcxLogger.warn("Angel One WebSocket Closed. Reconnecting...");
      setTimeout(() => this.connectWebSocket(), 5000);
    });
  }

  private static async subscribe() {
    // Resolve tokens for configured symbols
    const tokens = [];
    for (const symbol of mcxConfig.marketData.symbols) {
      try {
        const contract = await MarketDataService.resolveContract(symbol);
        tokens.push({
          exchangeType: 5, // MCX
          tokens: [contract.token],
        });
      } catch (error: any) {
        mcxLogger.warn("Failed to resolve contract for subscription", { symbol, error: error.message });
      }
    }

    if (tokens.length > 0) {
      this.ws.subscribe({
        correlationId: "mcx_feed",
        action: 1, // Subscribe
        mode: 3, // SnapQuote (gives ltp, vol, etc)
        tokens,
      });
      mcxLogger.info("Subscribed to Angel One feeds", { tokens });
    }
  }

  private static handleTick(tick: any) {
    // mcxLogger.info("Raw Angel One Tick", { tick });
    if (!tick) return;
    
    // In WebSocketV2, tick might be an array or object.
    // If it is SnapQuote mode (3), it should have last_traded_price.
    const token = tick.token;
    const ltp = tick.last_traded_price ? tick.last_traded_price / 100 : 0;

    if (token && ltp > 0) {
      mcxLogger.info("Ingesting Tick", { token, price: ltp });
      void MarketDataService.ingestTick({
        token,
        price: ltp,
        volume: tick.volume_traded || 0,
        timestamp: new Date(),
        raw: tick,
      }).catch((error) => {
        mcxLogger.warn("Tick ingestion failed", { token, error: error.message });
      });
    } else if (token) {
      // mcxLogger.warn("Received tick with 0 or missing price", { token, tick });
    }
  }

  static async fetchHistoricalCandles(symbol: string, interval: string, from: Date, to: Date) {
    if (!this.smartApi) await this.login();

    const contract = await MarketDataService.resolveContract(symbol);
    const intervalMap: Record<string, string> = {
      "1m": "ONE_MINUTE",
      "5m": "FIVE_MINUTE",
      "15m": "FIFTEEN_MINUTE",
    };

    const response = await this.smartApi.getCandleData({
      exchange: "MCX",
      symboltoken: contract.token,
      interval: intervalMap[interval] || "FIFTEEN_MINUTE",
      fromdate: this.formatDate(from),
      todate: this.formatDate(to),
    });

    if (!response.status) {
      throw new Error(`Failed to fetch historical candles: ${response.message}`);
    }

    return response.data; // [[time, o, h, l, c, v], ...]
  }

  private static formatDate(date: Date): string {
    return date.toISOString().replace("T", " ").substring(0, 16);
  }
}
