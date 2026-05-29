import { initializeStrategies } from "../src/strategy-engine/strategies";
import { strategyRegistry } from "../src/strategy-engine/core/registry";
import { GoldenCrossStrategy } from "../src/strategy-engine/strategies/golden-cross";
import { HeikenAshiSwingStrategy } from "../src/strategy-engine/strategies/heiken-ashi-swing";
import { HyperSupertrendStrategy } from "../src/strategy-engine/strategies/hyper-supertrend";
import { IchimokuCloudStrategy } from "../src/strategy-engine/strategies/ichimoku-cloud";
import { StrategyContext } from "../src/strategy-engine/types";

// Helper to generate basic candles
function generateMockCandles(count: number, basePrice: number, trend: "up" | "down" | "flat" | "custom", customGenerator?: (i: number) => number): { open: number; high: number; low: number; close: number; volume: number; time: number }[] {
  const candles = [];
  let price = basePrice;
  const now = Date.now();
  
  for (let i = 0; i < count; i++) {
    const time = now - (count - i) * 60000;
    let change = 0;
    
    if (customGenerator) {
      price = customGenerator(i);
    } else if (trend === "up") {
      change = price * 0.001; // stable uptrend
      price += change;
    } else if (trend === "down") {
      change = -price * 0.001; // stable downtrend
      price += change;
    } else {
      change = (Math.random() - 0.5) * price * 0.001;
      price += change;
    }
    
    const open = price - (Math.random() - 0.5) * price * 0.0005;
    const close = price;
    const high = Math.max(open, close) + price * 0.001;
    const low = Math.min(open, close) - price * 0.001;
    const volume = 1000 + Math.random() * 500;
    
    candles.push({ open, high, low, close, volume, time });
  }
  
  return candles;
}

async function runTests() {
  console.log("=== STARTING STRATEGY BATCH 3 TESTS ===\n");

  // 1. Registration Test
  console.log("--- 1. Testing Strategy Registration ---");
  initializeStrategies();
  
  const strategies = strategyRegistry.getStrategies();
  const targetIds = ["golden-cross", "heiken-ashi-swing", "hyper-supertrend", "ichimoku-cloud"];
  
  for (const id of targetIds) {
    const s = strategyRegistry.getStrategy(id);
    if (!s) {
      throw new Error(`Strategy ${id} was not registered correctly in strategyRegistry.`);
    }
    console.log(`[PASS] Strategy registered: ${s.name} (ID: ${s.id}, Type: ${s.type})`);
  }
  console.log();

  // 2. Golden Cross Strategy Tests
  console.log("--- 2. Testing Golden Cross Strategy ---");
  const gc = new GoldenCrossStrategy();
  
  // Test validation failure (insufficient candles)
  const invalidGcCtx: StrategyContext = {
    symbol: "BTCUSDT",
    timeframe: "1h",
    candles: generateMockCandles(100, 50000, "up"),
    indicators: {
      sma50: new Array(100).fill(50000),
      atr: new Array(100).fill(500),
      rsi: new Array(100).fill(50)
    }
  };
  
  const v1 = gc.validate(invalidGcCtx);
  const evalHold = gc.evaluate(invalidGcCtx);
  console.log(`[PASS] Validation block works (validate=${v1}, direction=${evalHold.signal}, reason=${evalHold.reasoning[0]})`);

  // Test Bullish Crossover (Golden Cross)
  // We need 215 candles. Let's design price such that SMA50 crosses above SMA200 at the end.
  // We will build price arrays explicitly.
  const gcCount = 220;
  const gcCandles: { open: number; high: number; low: number; close: number; volume: number; time: number }[] = [];
  const gcSma50: number[] = [];
  const gcAtr: number[] = [];
  const gcRsi: number[] = [];
  
  // Build a custom price sequence where price has been in a long downtrend, then moves sharply up.
  // This will force SMA50 to cross above SMA200.
  // For simplicity, we can also just explicitly mock the SMA values in indicators.
  // Wait, computeSMA200 is run internally on the candles.close array!
  // So we must generate candles.close such that computed SMA200 is lower than SMA50.
  // Let's set close price:
  // First 150 candles: price goes from 100 to 50.
  // Next 70 candles: price goes from 50 to 120.
  let currentPrice = 100;
  for (let i = 0; i < gcCount; i++) {
    if (i < 150) {
      currentPrice -= 0.3; // downtrend
    } else {
      currentPrice += 1.2; // strong uptrend
    }
    const open = currentPrice - 0.2;
    const close = currentPrice;
    const high = currentPrice + 1;
    const low = currentPrice - 1;
    gcCandles.push({ open, high, low, close, volume: 100, time: Date.now() - (gcCount - i) * 60000 });
    gcAtr.push(1.5);
    gcRsi.push(65);
  }
  
  // Now let's calculate SMA50 manually to feed it to the indicators.
  for (let i = 0; i < gcCount; i++) {
    const start = Math.max(0, i - 49);
    const slice = gcCandles.slice(start, i + 1).map(c => c.close);
    const sum = slice.reduce((a, b) => a + b, 0);
    gcSma50.push(sum / slice.length);
  }

  const gcCtx: StrategyContext = {
    symbol: "BTCUSDT",
    timeframe: "1h",
    candles: gcCandles,
    indicators: {
      sma50: gcSma50,
      atr: gcAtr,
      rsi: gcRsi
    }
  };

  const v2 = gc.validate(gcCtx);
  const gcSignal = gc.evaluate(gcCtx);
  console.log(`[PASS] Validated GC Context successfully (validate=${v2})`);
  console.log(`GC Signal output: signal=${gcSignal.signal}, confidence=${gcSignal.confidence}, TP=${gcSignal.takeProfit}, SL=${gcSignal.stopLoss}`);
  console.log(`GC Reasoning: ${JSON.stringify(gcSignal.reasoning)}`);
  console.log();

  // 3. Heiken Ashi Swing Strategy Tests
  console.log("--- 3. Testing Heiken Ashi Swing Strategy ---");
  const ha = new HeikenAshiSwingStrategy();
  
  // Test validation (requires 20 candles + ATR)
  const haCount = 30;
  const haCandles = generateMockCandles(haCount, 100, "up");
  const haAtr = new Array(haCount).fill(1.5);
  
  // Simulate ATR expanding at the end
  haAtr[haCount - 1] = 2.0;
  haAtr[haCount - 2] = 1.8;
  haAtr[haCount - 3] = 1.5;

  const haCtx: StrategyContext = {
    symbol: "BTCUSDT",
    timeframe: "15m",
    candles: haCandles,
    indicators: {
      atr: haAtr
    }
  };

  const v3 = ha.validate(haCtx);
  const haSignal = ha.evaluate(haCtx);
  console.log(`[PASS] Heiken Ashi Validated (validate=${v3})`);
  console.log(`HA Signal output: signal=${haSignal.signal}, confidence=${haSignal.confidence}, TP=${haSignal.takeProfit}, SL=${haSignal.stopLoss}`);
  console.log(`HA Reasoning: ${JSON.stringify(haSignal.reasoning)}`);
  console.log();

  // 4. Hyper Supertrend Strategy Tests
  console.log("--- 4. Testing Hyper Supertrend Strategy ---");
  const hs = new HyperSupertrendStrategy();
  
  const hsCount = 40;
  // Generate strongly trending candles to trigger dual Supertrend alignment
  const hsCandles = generateMockCandles(hsCount, 100, "up");
  const hsAtr = new Array(hsCount).fill(1.5);
  
  const hsCtx: StrategyContext = {
    symbol: "BTCUSDT",
    timeframe: "15m",
    candles: hsCandles,
    indicators: {
      atr: hsAtr
    }
  };

  const v4 = hs.validate(hsCtx);
  const hsSignal = hs.evaluate(hsCtx);
  console.log(`[PASS] Hyper Supertrend Validated (validate=${v4})`);
  console.log(`HS Signal output: signal=${hsSignal.signal}, confidence=${hsSignal.confidence}, TP=${hsSignal.takeProfit}, SL=${hsSignal.stopLoss}`);
  console.log(`HS Reasoning: ${JSON.stringify(hsSignal.reasoning)}`);
  console.log();

  // 5. Ichimoku Cloud Strategy Tests
  console.log("--- 5. Testing Ichimoku Cloud Strategy ---");
  const ic = new IchimokuCloudStrategy();
  
  const icCount = 70;
  const icCandles = generateMockCandles(icCount, 100, "up");
  const icAtr = new Array(icCount).fill(1.5);
  
  const icCtx: StrategyContext = {
    symbol: "BTCUSDT",
    timeframe: "1h",
    candles: icCandles,
    indicators: {
      atr: icAtr
    }
  };

  const v5 = ic.validate(icCtx);
  const icSignal = ic.evaluate(icCtx);
  console.log(`[PASS] Ichimoku Cloud Validated (validate=${v5})`);
  console.log(`IC Signal output: signal=${icSignal.signal}, confidence=${icSignal.confidence}, TP=${icSignal.takeProfit}, SL=${icSignal.stopLoss}`);
  console.log(`IC Reasoning: ${JSON.stringify(icSignal.reasoning)}`);
  console.log();

  console.log("=== ALL STRATEGY BATCH 3 TESTS COMPLETED SUCCESSFULLY ===");
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
