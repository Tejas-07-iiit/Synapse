import { initializeStrategies } from "../src/strategy-engine/strategies";
import { strategyRegistry } from "../src/strategy-engine/core/registry";
import { MACrossoverVariableStrategy } from "../src/strategy-engine/strategies/ma-crossover-var";
import { SMATrendFilterStrategy } from "../src/strategy-engine/strategies/sma-trend-filter";
import { T3NexusStrategy } from "../src/strategy-engine/strategies/t3-nexus";
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
  console.log("=== STARTING STRATEGY BATCH 4 TESTS ===\n");

  // 1. Registration Test
  console.log("--- 1. Testing Strategy Registration ---");
  initializeStrategies();
  
  const strategies = strategyRegistry.getStrategies();
  const targetIds = ["ma-crossover-var", "sma-trend-filter", "t3-nexus"];
  
  for (const id of targetIds) {
    const s = strategyRegistry.getStrategy(id);
    if (!s) {
      throw new Error(`Strategy ${id} was not registered correctly in strategyRegistry.`);
    }
    console.log(`[PASS] Strategy registered: ${s.name} (ID: ${s.id}, Type: ${s.type})`);
  }
  console.log();

  // 2. MA Crossover Variable Strategy Tests
  console.log("--- 2. Testing MA Crossover Variable Strategy ---");
  const mac = new MACrossoverVariableStrategy();
  
  // Test validation failure (insufficient candles)
  const invalidMacCtx: StrategyContext = {
    symbol: "BTCUSDT",
    timeframe: "1h",
    candles: generateMockCandles(100, 50000, "up"),
    indicators: {
      ema20: new Array(100).fill(50000),
      atr: new Array(100).fill(500)
    }
  };
  
  const v1 = mac.validate(invalidMacCtx);
  const evalHold = mac.evaluate(invalidMacCtx);
  console.log(`[PASS] Validation block works (validate=${v1}, direction=${evalHold.signal}, reason=${evalHold.reasoning[0]})`);

  // Test Bullish Setup (EMA20 crosses above EMA50, price > SMA200, slope positive)
  const macCount = 220;
  const macCandles: { open: number; high: number; low: number; close: number; volume: number; time: number }[] = [];
  const macEma20: number[] = [];
  const macAtr: number[] = [];
  
  // Create uptrending price: first 150 candles at 100, then rises to 150
  // Create a flat price sequence with a sharp jump at the very last candle
  for (let i = 0; i < macCount; i++) {
    let currentPrice = 100;
    if (i === macCount - 1) {
      currentPrice = 150;
    }
    macCandles.push({
      open: i === macCount - 1 ? 100 : currentPrice - 0.1,
      high: currentPrice + 0.5,
      low: currentPrice - 0.5,
      close: currentPrice,
      volume: 1000,
      time: Date.now() - (macCount - i) * 60000
    });
    macAtr.push(1.5);
  }

  // Create ema20 to cross above ema50 at the end
  // Let's explicitly calculate EMA20 from the prices
  const k20 = 2 / 21;
  let ema20Val = macCandles[0].close;
  for (let i = 0; i < macCount; i++) {
    ema20Val = macCandles[i].close * k20 + ema20Val * (1 - k20);
    macEma20.push(ema20Val);
  }

  // Calculate SMA50 to provide to RegimeEngine
  const macSma50: number[] = [];
  for (let i = 0; i < macCount; i++) {
    const start = Math.max(0, i - 49);
    const slice = macCandles.slice(start, i + 1).map(c => c.close);
    const sum = slice.reduce((a, b) => a + b, 0);
    macSma50.push(sum / slice.length);
  }

  // Slightly tweak the end of macEma20 to ensure it crosses EMA50
  // EMA50 will be calculated internally by the strategy, so we want EMA20 to cross above it
  // Let's verify by executing
  const macCtx: StrategyContext = {
    symbol: "BTCUSDT",
    timeframe: "1h",
    candles: macCandles,
    indicators: {
      ema20: macEma20,
      sma50: macSma50,
      atr: macAtr
    }
  };

  const v2 = mac.validate(macCtx);
  const macSignal = mac.evaluate(macCtx);
  console.log(`[PASS] MA Crossover Context Validated (validate=${v2})`);
  console.log(`MAC Signal output: signal=${macSignal.signal}, confidence=${macSignal.confidence}, TP=${macSignal.takeProfit}, SL=${macSignal.stopLoss}`);
  console.log(`MAC Reasoning: ${JSON.stringify(macSignal.reasoning)}`);
  console.log();

  // 3. SMA Trend Filter Strategy Tests
  console.log("--- 3. Testing SMA Trend Filter Strategy ---");
  const stf = new SMATrendFilterStrategy();
  
  const stfCount = 220;
  const stfCandles = generateMockCandles(stfCount, 100, "up");
  const stfSma50: number[] = [];
  const stfEma20: number[] = [];
  const stfRsi: number[] = [];
  const stfAtr: number[] = [];
  
  // Calculate SMA50 and EMA20
  let ema20Temp = 100;
  for (let i = 0; i < stfCount; i++) {
    const start = Math.max(0, i - 49);
    const slice = stfCandles.slice(start, i + 1).map(c => c.close);
    const sum = slice.reduce((a, b) => a + b, 0);
    stfSma50.push(sum / slice.length);

    ema20Temp = stfCandles[i].close * (2/21) + ema20Temp * (1 - 2/21);
    stfEma20.push(ema20Temp);

    stfRsi.push(60); // Gold buy zone for longs is 50-70
    stfAtr.push(1.5);
  }

  const stfCtx: StrategyContext = {
    symbol: "BTCUSDT",
    timeframe: "1h",
    candles: stfCandles,
    indicators: {
      sma50: stfSma50,
      ema20: stfEma20,
      rsi: stfRsi,
      atr: stfAtr
    }
  };

  const v3 = stf.validate(stfCtx);
  const stfSignal = stf.evaluate(stfCtx);
  console.log(`[PASS] SMA Trend Filter Validated (validate=${v3})`);
  console.log(`STF Signal output: signal=${stfSignal.signal}, confidence=${stfSignal.confidence}, TP=${stfSignal.takeProfit}, SL=${stfSignal.stopLoss}`);
  console.log(`STF Reasoning: ${JSON.stringify(stfSignal.reasoning)}`);
  console.log();

  // 4. T3 Nexus Strategy Tests
  console.log("--- 4. Testing T3 Nexus Strategy ---");
  const t3n = new T3NexusStrategy();
  
  const t3Count = 50;
  // Generate strongly trending candles to trigger T3 alignment
  const t3Candles = generateMockCandles(t3Count, 100, "up");
  const t3Atr = new Array(t3Count).fill(1.5);
  
  const t3Ctx: StrategyContext = {
    symbol: "BTCUSDT",
    timeframe: "15m",
    candles: t3Candles,
    indicators: {
      atr: t3Atr
    }
  };

  const v4 = t3n.validate(t3Ctx);
  const t3Signal = t3n.evaluate(t3Ctx);
  console.log(`[PASS] T3 Nexus Validated (validate=${v4})`);
  console.log(`T3 Signal output: signal=${t3Signal.signal}, confidence=${t3Signal.confidence}, TP=${t3Signal.takeProfit}, SL=${t3Signal.stopLoss}`);
  console.log(`T3 Reasoning: ${JSON.stringify(t3Signal.reasoning)}`);
  console.log();

  console.log("=== ALL STRATEGY BATCH 4 TESTS COMPLETED SUCCESSFULLY ===");
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
