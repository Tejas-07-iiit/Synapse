import { useDashboardStore } from "@/store/dashboard/useDashboardStore";
import { TickerInfo, BinanceTickerPayload } from "@/types/market";

class BinanceWebsocketService {
  private socket: WebSocket | null = null;
  private reconnectDelay = 2000;
  private maxReconnectDelay = 30000;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private lastMessageTime = Date.now();
  private isDisconnecting = false;
  private subscribedSymbols: Set<string> = new Set();

  public connect() {
    if (typeof window === "undefined") return; // Keep server-side safe
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isDisconnecting = false;
    this.cleanupTimers();

    try {
      console.log("Connecting to Binance WebSocket...");
      this.socket = new WebSocket("wss://stream.binance.com:9443/ws");

      this.socket.onopen = () => {
        console.log("Binance WebSocket connection established.");
        this.reconnectDelay = 2000; // Reset reconnect delay on success
        this.lastMessageTime = Date.now();
        useDashboardStore.getState().setWsConnectionState(true);

        // Subscribe to current symbols
        this.sendSubscriptions();
        this.startHeartbeat();
      };

      this.socket.onmessage = (event) => {
        this.lastMessageTime = Date.now();
        
        try {
          const data = JSON.parse(event.data);
          
          // Handle 24h Ticker event
          if (data && data.e === "24hrTicker") {
            const rawTicker = data as BinanceTickerPayload;
            const normalizedTicker: TickerInfo = {
              symbol: rawTicker.s,
              price: parseFloat(rawTicker.c),
              priceChange24h: parseFloat(rawTicker.p),
              priceChangePercent24h: parseFloat(rawTicker.P),
              volume24h: parseFloat(rawTicker.v),
              high24h: parseFloat(rawTicker.h),
              low24h: parseFloat(rawTicker.l),
              lastUpdate: rawTicker.E,
            };
            
            useDashboardStore.getState().updateTicker(rawTicker.s, normalizedTicker);
          }
        } catch (err) {
          console.error("Error parsing WebSocket message:", err);
        }
      };

      this.socket.onclose = (event) => {
        console.log(`Binance WebSocket closed. Code: ${event.code}.`);
        useDashboardStore.getState().setWsConnectionState(false);
        this.cleanupHeartbeat();

        if (!this.isDisconnecting) {
          this.triggerReconnect();
        }
      };

      this.socket.onerror = (error) => {
        console.error("Binance WebSocket error:", error);
        useDashboardStore.getState().setWsConnectionState(false, "WebSocket connection error");
      };

    } catch (err: any) {
      console.error("WebSocket setup failed:", err);
      useDashboardStore.getState().setWsConnectionState(false, err.message || "Failed to set up socket");
      this.triggerReconnect();
    }
  }

  public subscribe(symbols: string[]) {
    const formatted = symbols.map(s => s.toLowerCase());
    const newSymbols: string[] = [];

    for (const sym of formatted) {
      if (!this.subscribedSymbols.has(sym)) {
        this.subscribedSymbols.add(sym);
        newSymbols.push(sym);
      }
    }

    if (newSymbols.length > 0 && this.socket && this.socket.readyState === WebSocket.OPEN) {
      const streams = newSymbols.map(sym => `${sym}@ticker`);
      const payload = {
        method: "SUBSCRIBE",
        params: streams,
        id: Date.now(),
      };
      this.socket.send(JSON.stringify(payload));
      console.log("Subscribed to streams:", streams);
    }
  }

  public unsubscribe(symbols: string[]) {
    const formatted = symbols.map(s => s.toLowerCase());
    const removeSymbols: string[] = [];

    for (const sym of formatted) {
      if (this.subscribedSymbols.has(sym)) {
        this.subscribedSymbols.delete(sym);
        removeSymbols.push(sym);
      }
    }

    if (removeSymbols.length > 0 && this.socket && this.socket.readyState === WebSocket.OPEN) {
      const streams = removeSymbols.map(sym => `${sym}@ticker`);
      const payload = {
        method: "UNSUBSCRIBE",
        params: streams,
        id: Date.now(),
      };
      this.socket.send(JSON.stringify(payload));
      console.log("Unsubscribed from streams:", streams);
    }
  }

  public disconnect() {
    this.isDisconnecting = true;
    this.cleanupTimers();
    this.subscribedSymbols.clear();

    if (this.socket) {
      if (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) {
        this.socket.close();
      }
      this.socket = null;
    }
    useDashboardStore.getState().setWsConnectionState(false);
  }

  private sendSubscriptions() {
    if (this.subscribedSymbols.size > 0 && this.socket && this.socket.readyState === WebSocket.OPEN) {
      const streams = Array.from(this.subscribedSymbols).map(sym => `${sym}@ticker`);
      const payload = {
        method: "SUBSCRIBE",
        params: streams,
        id: Date.now(),
      };
      this.socket.send(JSON.stringify(payload));
      console.log("Sent initial subscriptions:", streams);
    }
  }

  private triggerReconnect() {
    if (this.reconnectTimer) return;

    console.log(`Reconnecting to Binance in ${this.reconnectDelay}ms...`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
      // Exponential backoff
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
    }, this.reconnectDelay);
  }

  private startHeartbeat() {
    this.cleanupHeartbeat();
    
    // Check connection health every 10 seconds
    this.heartbeatTimer = setInterval(() => {
      const timeSinceLastMessage = Date.now() - this.lastMessageTime;
      // If we haven't received a message for 20 seconds, assume dead connection
      if (timeSinceLastMessage > 20000) {
        console.warn("WebSocket heartbeat failed. No message received recently. Reconnecting...");
        if (this.socket) {
          this.socket.close(); // Triggers onclose event handlers which handles reconnects
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

// Export single instance of the service
export const wsService = new BinanceWebsocketService();
