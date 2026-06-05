import * as fs from 'fs';
import * as path from 'path';

const CACHE_FILE = path.join(__dirname, '../src/replay/cache/candles_BTCUSDT_15m_90d.json');

if (!fs.existsSync(CACHE_FILE)) {
    console.error("Cache file not found:", CACHE_FILE);
    process.exit(1);
}

const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
const targetTime = new Date('2026-03-10T09:29:59.999Z').getTime();

const targetCandle = data.find((c: any) => c.closeTime === targetTime);

if (targetCandle) {
    console.log("Found target candle:", targetCandle);
} else {
    console.log("Candle not found for timestamp", targetTime);
    // Find closest
    let closest = data[0];
    let minDiff = Infinity;
    for (let c of data) {
        const diff = Math.abs(c.closeTime - targetTime);
        if (diff < minDiff) {
            minDiff = diff;
            closest = c;
        }
    }
    console.log("Closest candle:", closest, "diff:", minDiff);
}
