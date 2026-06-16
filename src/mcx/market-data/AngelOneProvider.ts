import { SmartAPI, WebSocketV2 } from "smartapi-javascript";
import crypto from "crypto";
import { mcxConfig } from "../config/mcx.config";
import { mcxLogger } from "../utils/logger";
import { MarketDataService } from "./MarketDataService";
import { SimulatedMarketDataProvider } from "./SimulatedMarketDataProvider";
import prisma from "@/lib/prisma";

/**
 * Manual TOTP Implementation to avoid otplib version conflicts and strict secret length rules.
 */
function generateTOTP(secret: string): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  let index = 0;
  const key = Buffer.alloc(Math.ceil(secret.length * 5 / 8));

  for (let i = 0; i < secret.length; i++) {
    const char = secret[i].toUpperCase();
    if (char === "=") break;
    const val = alphabet.indexOf(char);
    if (val === -1) continue;
    value = (value << 5) | val;
    bits += 5;
    if (bits >= 8) {
      key[index++] = (value >> (bits - 8)) & 255;
      bits -= 8;
    }
  }

  const epoch = Math.floor(Date.now() / 1000);
  const time = Buffer.alloc(8);
  time.writeBigInt64BE(BigInt(Math.floor(epoch / 30)), 0);

  const hmac = crypto.createHmac("sha1", key.subarray(0, index)).update(time).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac[offset] & 0x7f) << 24) |
               ((hmac[offset + 1] & 0xff) << 16) |
               ((hmac[offset + 2] & 0xff) << 8) |
               (hmac[offset + 3] & 0xff);

  return (code % 1000000).toString().padStart(6, "0");
}

export class AngelOneProvider {
  private static smartApi: any = null;
  private static ws: any = null;
  private static sessionData: any = null;
  private static initialized = false;

  static async initialize() {
    if (this.initialized) return;
    this.initialized = true;

    mcxLogger.info("AngelOneProvider: Starting initialization...");
    if (!this.hasCredentials()) {
      mcxLogger.warn("AngelOneProvider: Missing credentials. Falling back to SimulatedMarketDataProvider.");
      SimulatedMarketDataProvider.start("Missing credentials");
      return;
    }

    try {
      this.sessionData = await this.login();
      mcxLogger.info("AngelOneProvider: Login successful, starting backfill...");
      await this.backfillAll();
      mcxLogger.info("AngelOneProvider: Backfill complete, connecting WebSocket...");
      await this.connectWebSocket();
      mcxLogger.info("AngelOneProvider Initialized successfully");
      SimulatedMarketDataProvider.stop();
    } catch (error: any) {
      mcxLogger.error("AngelOneProvider Initialization Failed. Falling back to SimulatedMarketDataProvider.", { error: error.message, stack: error.stack });
      this.initialized = false;
      SimulatedMarketDataProvider.start(`AngelOneProvider failed: ${error.message}`);
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
    const from = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days back

    for (const symbol of mcxConfig.marketData.symbols) {
      try {
        const contract = await MarketDataService.resolveContract(symbol);
        mcxLogger.info(`Backfilling ${symbol} using contract ${contract.contractName} (Token: ${contract.token})`);

        for (const interval of mcxConfig.marketData.intervals) {
          try {
            const candles = await this.fetchHistoricalCandles(symbol, interval, from, to);
            if (candles && candles.length > 0) {
              const formatted = candles.map((c: any) => ({
                symbol,
                token: contract.token,
                exchange: contract.exchange,
                expiry: contract.expiry,
                contractName: contract.contractName,
                interval,
                timestamp: new Date(String(c[0]).includes("+") ? c[0] : `${c[0]} +0530`),
                open: Number(c[1]),
                high: Number(c[2]),
                low: Number(c[3]),
                close: Number(c[4]),
                volume: Number(c[5]),
                isClosed: true,
              }));

              // Use createMany to seed/backfill candles in one DB roundtrip
              await prisma.mcxCandle.createMany({
                data: formatted,
                skipDuplicates: true,
              });
              mcxLogger.info(`Backfilled ${candles.length} candles for ${symbol} @ ${interval}`);
            } else {
              mcxLogger.warn(`No historical candles returned for ${symbol} @ ${interval}`);
            }
          } catch (error: any) {
            mcxLogger.warn(`Backfill failed for ${symbol} @ ${interval}`, { error: error.message });
          }
          // Delay between intervals
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        // Small delay between symbols to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (err: any) {
        mcxLogger.error(`Failed to resolve contract for backfill of ${symbol}`, { error: err.message });
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
      const totp = generateTOTP(totpSecret);
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
    if (!this.sessionData) throw new Error("No session data available for WebSocket");
    
    const feedToken = this.sessionData.feedToken;

    this.ws = new WebSocketV2({
      apikey: apiKey,
      clientcode: clientId,
      feedtype: feedToken,
      jwttoken: this.sessionData.jwtToken,
    });

    this.ws.on("connect", () => {
      mcxLogger.info("Angel One WebSocket Connected (via event)");
      this.subscribe();
    });

    try {
      await this.ws.connect();
      mcxLogger.info("Angel One WebSocket Connected (via promise)");
      await this.subscribe();
    } catch (error: any) {
      mcxLogger.error("Angel One WebSocket Connection Failed", { error: error.message || error });
    }

    this.ws.on("tick", (tick: any) => {
      // console.log("RAW_TICK", tick);
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
    const tokens = [];
    for (const symbol of mcxConfig.marketData.symbols) {
      try {
        const contract = await MarketDataService.resolveContract(symbol);
        tokens.push({
          exchangeType: 5,
          tokens: [contract.token],
        });
      } catch (error: any) {
        mcxLogger.warn("Failed to resolve contract for subscription", { symbol, error: error.message });
      }
    }

    if (tokens.length > 0) {
      this.ws.fetchData({
        correlationID: "mcx_feed",
        action: 1,
        mode: 3,
        exchangeType: 5,
        tokens: tokens.flatMap((t) => t.tokens),
      });
      mcxLogger.info("Subscribed to Angel One feeds", { tokens });
    }
  }

  private static tickCount = 0;
  private static handleTick(tick: any) {
    if (!tick) return;
    
    this.tickCount++;
    if (this.tickCount % 50 === 0) {
      mcxLogger.info(`Stream active: received ${this.tickCount} ticks`);
    }

    const token = tick.token;
    const ltp = tick.last_traded_price ? tick.last_traded_price / 100 : 0;
    if (token && ltp > 0) {
      void MarketDataService.ingestTick({
        token,
        price: ltp,
        volume: tick.volume_traded || 0,
        timestamp: new Date(),
        raw: tick,
      }).catch((error) => {
        mcxLogger.warn("Tick ingestion failed", { token, error: error.message });
      });
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
    
    const fromStr = this.formatDate(from);
    const toStr = this.formatDate(to);
    mcxLogger.info(`Fetching candles for ${symbol} @ ${interval}: ${fromStr} to ${toStr}`);

    const response = await this.smartApi.getCandleData({
      exchange: "MCX",
      symboltoken: contract.token,
      interval: intervalMap[interval] || "FIFTEEN_MINUTE",
      fromdate: fromStr,
      todate: toStr,
    });
    if (!response.status) {
      throw new Error(`Failed to fetch historical candles: ${response.message}`);
    }
    mcxLogger.info(`Fetched ${response.data ? response.data.length : 0} candles for ${symbol} @ ${interval}`);
    return response.data;
  }

  private static formatDate(date: Date): string {
    // Angel One API expects "YYYY-MM-DD HH:mm" in IST.
    // We offset the date by 5.5 hours if the server is in UTC.
    // But more reliably, we can use local string parts.
    const pad = (n: number) => n.toString().padStart(2, "0");
    
    // We assume the system/environment is set to Asia/Kolkata or we manually offset.
    // To be safe across any server TZ, we force IST offset (+5.5h)
    const istDate = new Date(date.getTime() + (5.5 * 60 * 60 * 1000));
    
    const y = istDate.getUTCFullYear();
    const m = pad(istDate.getUTCMonth() + 1);
    const d = pad(istDate.getUTCDate());
    const hh = pad(istDate.getUTCHours());
    const mm = pad(istDate.getUTCMinutes());
    
    return `${y}-${m}-${d} ${hh}:${mm}`;
  }
}
