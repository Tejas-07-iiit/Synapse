async function fetchBinanceKlines(symbol, interval, startTime, endTime) {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&startTime=${startTime}&endTime=${endTime}&limit=10`;
  const res = await fetch(url);
  const data = await res.json();
  return data.map(d => ({
    openTime: new Date(d[0]).toISOString(),
    openTimeMs: d[0],
    closeTime: new Date(d[6]).toISOString(),
    open: parseFloat(d[1]),
    high: parseFloat(d[2]),
    low: parseFloat(d[3]),
    close: parseFloat(d[4]),
    volume: parseFloat(d[5])
  }));
}

async function main() {
  const symbol = "BTCUSDT";
  // The trade opened at 2026-06-03T07:30:00.477Z
  // Let's query around that time: from 07:00:00 to 08:00:00
  const startTime = new Date("2026-06-03T07:00:00Z").getTime();
  const endTime = new Date("2026-06-03T08:00:00Z").getTime();

  console.log("BINANCE KLINES FOR BTCUSDT ON 2026-06-03:");

  const timeframes = ["1m", "3m", "5m", "15m", "30m", "1h"];
  for (const tf of timeframes) {
    try {
      const klines = await fetchBinanceKlines(symbol, tf, startTime, endTime);
      console.log(`\nTimeframe: ${tf}`);
      for (const k of klines) {
        console.log(`  Open: ${k.openTime} | Close: ${k.closeTime} | O: ${k.open} | H: ${k.high} | L: ${k.low} | C: ${k.close}`);
      }
    } catch (e) {
      console.error(`Failed to fetch for ${tf}:`, e.message);
    }
  }
}

main().catch(console.error);
