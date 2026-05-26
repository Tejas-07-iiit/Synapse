export function getSupportedSymbols(): string[] {
  const envCoins = process.env.NEXT_PUBLIC_SUPPORTED_COINS;
  if (!envCoins) {
    return ["BTCUSDT", "ETHUSDT", "SOLUSDT"]; // Default fallback
  }
  return envCoins
    .split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter((symbol) => symbol.length > 0);
}

export function isValidSymbol(symbol: string): boolean {
  const supported = getSupportedSymbols();
  return supported.includes(symbol.toUpperCase());
}
