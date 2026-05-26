import { TickerInfo } from "@/types/market";

export async function fetch24hTicker(symbol: string): Promise<TickerInfo> {
  const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol.toUpperCase()}`);
  if (!res.ok) {
    throw new Error(`Binance Ticker API error: ${res.statusText}`);
  }
  const data = await res.json();
  return {
    symbol: data.symbol,
    price: parseFloat(data.lastPrice),
    priceChange24h: parseFloat(data.priceChange),
    priceChangePercent24h: parseFloat(data.priceChangePercent),
    volume24h: parseFloat(data.volume),
    high24h: parseFloat(data.highPrice),
    low24h: parseFloat(data.lowPrice),
    lastUpdate: data.closeTime,
  };
}

export async function fetch24hTickers(symbols: string[]): Promise<Record<string, TickerInfo>> {
  if (symbols.length === 0) return {};
  
  try {
    const formattedSymbols = symbols.map(s => s.toUpperCase());
    const symbolsParam = encodeURIComponent(JSON.stringify(formattedSymbols));
    const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${symbolsParam}`);
    
    if (!res.ok) {
      throw new Error(`Binance Ticker API error: ${res.statusText}`);
    }
    
    const data = await res.json();
    const results: Record<string, TickerInfo> = {};
    
    if (Array.isArray(data)) {
      for (const item of data) {
        results[item.symbol] = {
          symbol: item.symbol,
          price: parseFloat(item.lastPrice),
          priceChange24h: parseFloat(item.priceChange),
          priceChangePercent24h: parseFloat(item.priceChangePercent),
          volume24h: parseFloat(item.volume),
          high24h: parseFloat(item.highPrice),
          low24h: parseFloat(item.lowPrice),
          lastUpdate: item.closeTime,
        };
      }
    }
    
    return results;
  } catch (error) {
    console.error("Failed to fetch tickers:", error);
    return {};
  }
}
