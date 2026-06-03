import { TickerInfo, Candle } from "../../strategy-engine/types";
import { normalizer } from "../normalization";
import { useMarketStore } from "../../stores/marketStore";

export interface BinanceKlinePayload {
  e: string;
  E: number;
  s: string;
  k: {
    t: number;
    T: number;
    s: string;
    i: string;
    f: number;
    L: number;
    o: string;
    c: string;
    h: string;
    l: string;
    v: string;
    n: number;
    x: boolean; // Is kline closed
    q: string;
    V: string;
    Q: string;
    B: string;
  };
}

export type TickerCallback = (symbol: string, ticker: TickerInfo) => void;
export type CandleCallback = (symbol: string, interval: string, candle: Candle, isClosed: boolean) => void;

class WebSocketService {
  private socket: any = null;
  private reconnectDelay = 2000;
  private maxReconnectDelay = 30000;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private lastMessageTime = Date.now();
  private isDisconnecting = false;

  private activeStreams: Map<string, number> = new Map();
  private tickerCallbacks: Set<TickerCallback> = new Set();
  private candleCallbacks: Set<CandleCallback> = new Set();

  public registerTickerCallback(cb: TickerCallback) {
    this.tickerCallbacks.add(cb);
    return () => this.tickerCallbacks.delete(cb);
  }

  public registerCandleCallback(cb: CandleCallback) {
    this.candleCallbacks.add(cb);
    return () => this.candleCallbacks.delete(cb);
  }

  private getWSConstructor() {
    if (typeof window !== "undefined") {
      return WebSocket;
    }
    return eval('require("ws")');
  }

  public connect() {
    const WS = this.getWSConstructor();

    if (this.socket && (this.socket.readyState === WS.OPEN || this.socket.readyState === WS.CONNECTING)) {
      return;
    }

    this.isDisconnecting = false;
    this.cleanupTimers();

    const store = useMarketStore.getState();

    try {
      console.log("[WS-Engine] Connecting to Binance Market WebSocket...");
      
      if (store.wsStatus === "DISCONNECTED") {
        store.setWsStatus("RECONNECTING");
      }

      this.socket = new WS("wss://stream.binance.com:9443/ws");

      this.socket.onopen = () => {
        console.log("[WS-Engine] Binance Market WebSocket open.");
        this.reconnectDelay = 2000;
        this.lastMessageTime = Date.now();
        
        store.setWsConnectionState(true);
        store.setWsStatus("CONNECTED");

        this.resubscribeActiveStreams();
        this.startHeartbeat();
      };

      this.socket.onmessage = (event: any) => {
        this.lastMessageTime = Date.now();
        try {
          const data = JSON.parse(event.data);
          
          if (!data) return;

          if (data.e === "24hrTicker") {
            const ticker = normalizer.normalizeWsTicker(data);
            this.tickerCallbacks.forEach((cb) => cb(ticker.symbol, ticker));
          }

          if (data.e === "kline") {
            const raw = data as BinanceKlinePayload;
            const candle = normalizer.normalizeWsKline(raw.k);
            this.candleCallbacks.forEach((cb) => cb(raw.s, raw.k.i, candle, raw.k.x));
          }
        } catch (err) {
          console.error("[WS-Engine] Error processing websocket message:", err);
        }
      };

      this.socket.onclose = () => {
        console.log("[WS-Engine] Binance Market WebSocket closed.");
        this.cleanupHeartbeat();
        
        store.setWsConnectionState(false);

        if (!this.isDisconnecting) {
          store.setWsStatus("RECONNECTING");
          this.triggerReconnect();
        } else {
          store.setWsStatus("DISCONNECTED");
        }
      };

      this.socket.onerror = (err: any) => {
        console.warn("[WS-Engine] Binance Market WebSocket error:", err);
        store.setWsConnectionState(false, "WebSocket connection error");
      };
    } catch (err) {
      console.warn("[WS-Engine] Binance Market WebSocket setup failed:", err);
      store.setWsConnectionState(false, (err as Error).message);
      this.triggerReconnect();
    }
  }

  public subscribe(streams: string[]) {
    const streamsToSubscribe: string[] = [];

    streams.forEach((stream) => {
      const s = stream.toLowerCase();
      const count = this.activeStreams.get(s) || 0;
      this.activeStreams.set(s, count + 1);

      if (count === 0) {
        streamsToSubscribe.push(s);
      }
    });

    const WS = this.getWSConstructor();
    if (streamsToSubscribe.length > 0 && this.socket && this.socket.readyState === WS.OPEN) {
      const payload = {
        method: "SUBSCRIBE",
        params: streamsToSubscribe,
        id: Date.now(),
      };
      this.socket.send(JSON.stringify(payload));
      console.log("[WS-Engine] Subscribed to streams:", streamsToSubscribe);
    }
  }

  public unsubscribe(streams: string[]) {
    const streamsToUnsubscribe: string[] = [];

    streams.forEach((stream) => {
      const s = stream.toLowerCase();
      const count = this.activeStreams.get(s) || 0;
      if (count <= 1) {
        this.activeStreams.delete(s);
        if (count === 1) {
          streamsToUnsubscribe.push(s);
        }
      } else {
        this.activeStreams.set(s, count - 1);
      }
    });

    const WS = this.getWSConstructor();
    if (streamsToUnsubscribe.length > 0 && this.socket && this.socket.readyState === WS.OPEN) {
      const payload = {
        method: "UNSUBSCRIBE",
        params: streamsToUnsubscribe,
        id: Date.now(),
      };
      this.socket.send(JSON.stringify(payload));
      console.log("[WS-Engine] Unsubscribed from streams:", streamsToUnsubscribe);
    }
  }

  public disconnect() {
    this.isDisconnecting = true;
    this.cleanupTimers();
    this.activeStreams.clear();

    const store = useMarketStore.getState();
    store.setWsConnectionState(false);
    store.setWsStatus("DISCONNECTED");

    const WS = this.getWSConstructor();
    if (this.socket) {
      if (this.socket.readyState === WS.OPEN || this.socket.readyState === WS.CONNECTING) {
        this.socket.close();
      }
      this.socket = null;
    }
  }

  public isConnected(): boolean {
    const WS = this.getWSConstructor();
    return !!(this.socket && this.socket.readyState === WS.OPEN);
  }

  public getSubscribedStreams(): string[] {
    return Array.from(this.activeStreams.keys());
  }

  private resubscribeActiveStreams() {
    const WS = this.getWSConstructor();
    const streams = Array.from(this.activeStreams.keys());
    if (streams.length === 0) return;
    if (this.socket && this.socket.readyState === WS.OPEN) {
      const payload = {
        method: "SUBSCRIBE",
        params: streams,
        id: Date.now(),
      };
      this.socket.send(JSON.stringify(payload));
      console.log("[WS-Engine] Resubscribed to streams:", streams);
    }
  }

  private triggerReconnect() {
    if (this.reconnectTimer) return;

    const store = useMarketStore.getState();
    store.setWsStatus("RECONNECTING");

    console.log(`[WS-Engine] Reconnecting in ${this.reconnectDelay}ms (Exponential Backoff)...`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
      this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, this.maxReconnectDelay);
    }, this.reconnectDelay);
  }

  private startHeartbeat() {
    this.cleanupHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      const timeSinceLastMessage = Date.now() - this.lastMessageTime;
      if (timeSinceLastMessage > 25000) {
        console.warn("[WS-Engine] Heartbeat monitoring failed: connection lost. Reconnecting...");
        if (this.socket) {
          this.socket.close();
        }
      }
    }, 10000);
  }

  private cleanupHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private cleanupTimers() {
    this.cleanupHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

export const marketWsService = new WebSocketService();
export default marketWsService;
