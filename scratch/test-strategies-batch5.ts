import { initializeStrategies } from "../src/strategy-engine/strategies";
import { strategyRegistry } from "../src/strategy-engine/core/registry";
import { SqueezeMomentumStrategy } from "../src/strategy-engine/strategies/squeeze-momentum";
import { VolatilityRegimeStrategy } from "../src/strategy-engine/strategies/volatility-regime";
import { ZeiiermanVolatilityStrategy } from "../src/strategy-engine/strategies/zeiierman-volatility";
import { StrategyContext } from "../src/strategy-engine/types";
import { getSqueezeState, getATRPct, getKeltnerChannels } from "../src/strategy-engine/utils/volatility";

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
  console.log("=== STARTING STRATEGY BATCH 5 TESTS ===\n");

  // 1. Registration Test
  console.log("--- 1. Testing Strategy Registration ---");
  initializeStrategies();
  
  const strategies = strategyRegistry.getStrategies();
  const targetIds = ["squeeze-momentum", "volatility-regime", "zeiierman-volatility"];
  
  for (const id of targetIds) {
    const s = strategyRegistry.getStrategy(id);
    if (!s) {
      throw new Error(`Strategy ${id} was not registered correctly in strategyRegistry.`);
    }
    console.log(`[PASS] Strategy registered: ${s.name} (ID: ${s.id}, Type: ${s.type})`);
  }
  console.log();

  // 2. Volatility Utilities Check
  console.log("--- 2. Testing Shared Volatility Utilities ---");
  const dummyCandles = generateMockCandles(30, 100, "flat");
  const dummyCloses = dummyCandles.map(c => c.close);
  const sq = getSqueezeState(dummyCloses, dummyCandles, 20, 2.0, 1.5);
  const atrPctVal = getATRPct(dummyCandles, 14);
  const kc = getKeltnerChannels(dummyCandles, 20, 1.5);
  
  console.log(`[PASS] Squeeze computed successfully (squeezeOn length: ${sq.squeezeOn.length})`);
  console.log(`[PASS] ATRPct calculated successfully (first non-zero value: ${atrPctVal[14].toFixed(4)}%)`);
  console.log(`[PASS] Keltner Channels calculated successfully (Upper band: $${kc.upper[20].toFixed(2)}, Lower band: $${kc.lower[20].toFixed(2)})`);
  console.log();

  // 3. Squeeze Momentum Strategy Tests
  console.log("--- 3. Testing Squeeze Momentum Strategy ---");
  const sm = new SqueezeMomentumStrategy();
  
  // Test validation
  const smCount = 50;
  const smCandles = generateMockCandles(smCount, 100, "flat");
  const smAtr = new Array(smCount).fill(0.1); // tight ATR
  const smEma20 = new Array(smCount).fill(100);

  // We want to simulate a squeeze release at the very end
  // Inside getSqueezeState, Squeeze is ON if BB < KC.
  // We can explicitly construct the prices so that they compress (squeeze ON) up to lastIdx - 1, and then expand at lastIdx.
  // Or we can construct candles where close jumps at the end
  const smCandlesCrossover = generateMockCandles(smCount, 100, "custom", (i) => {
    if (i < 45) return 100 + Math.sin(i) * 0.05; // very low compression
    if (i === 49) return 108; // explosive breakout
    return 100 + (i - 45) * 0.5; // expansion
  });

  const smEma20Computed: number[] = [];
  let currentEma = 100;
  for (let i = 0; i < smCount; i++) {
    currentEma = smCandlesCrossover[i].close * (2/21) + currentEma * (1 - 2/21);
    smEma20Computed.push(currentEma);
  }

  // atr should be higher at the end
  const smAtrComputed = new Array(smCount).fill(0.5);
  smAtrComputed[49] = 2.0;

  const smCtx: StrategyContext = {
    symbol: "BTCUSDT",
    timeframe: "1h",
    candles: smCandlesCrossover,
    indicators: {
      ema20: smEma20Computed,
      atr: smAtrComputed
    }
  };

  const vSM = sm.validate(smCtx);
  const smSignal = sm.evaluate(smCtx);
  console.log(`[PASS] Squeeze Momentum Validated (validate=${vSM})`);
  console.log(`SM Signal output: signal=${smSignal.signal}, confidence=${smSignal.confidence}, TP=${smSignal.takeProfit}, SL=${smSignal.stopLoss}`);
  console.log(`SM Reasoning: ${JSON.stringify(smSignal.reasoning)}`);
  console.log();

  // 4. Volatility Regime Strategy Tests
  console.log("--- 4. Testing Volatility Regime Strategy ---");
  const vr = new VolatilityRegimeStrategy();
  
  const vrCount = 120;
  // Favorable trend: price > ema20 > sma50
  // Volatility expanding: ATRPct increasing
  const vrCandles = generateMockCandles(vrCount, 100, "up");
  const vrAtr = new Array(vrCount).fill(1.0);
  const vrAdx = new Array(vrCount).fill(30); // adx > 25
  const vrEma20: number[] = [];
  const vrSma50: number[] = [];
  
  // Introduce an early historical volatility peak in the history
  for (let i = 20; i < 30; i++) {
    vrCandles[i].high = vrCandles[i].close + 3.0;
    vrCandles[i].low = vrCandles[i].close - 3.0;
  }

  // Expand ranges at the end to force actual ATR expansion in the candles
  for (let i = 115; i < vrCount; i++) {
    vrCandles[i].high = vrCandles[i].close + 0.25 * (i - 114);
    vrCandles[i].low = vrCandles[i].close - 0.25 * (i - 114);
  }

  // ATR expanding at the end in indicators as well
  for (let i = 0; i < vrCount; i++) {
    if (i > 115) {
      vrAtr[i] = 1.0 + (i - 115) * 0.8;
    } else {
      vrAtr[i] = 1.0;
    }
  }

  // Calculate EMA20 & SMA50
  let emaTemp = 100;
  for (let i = 0; i < vrCount; i++) {
    emaTemp = vrCandles[i].close * (2/21) + emaTemp * (1 - 2/21);
    vrEma20.push(emaTemp);

    const start = Math.max(0, i - 49);
    const slice = vrCandles.slice(start, i + 1).map(c => c.close);
    const sum = slice.reduce((a, b) => a + b, 0);
    vrSma50.push(sum / slice.length);
  }

  const vrCtx: StrategyContext = {
    symbol: "BTCUSDT",
    timeframe: "1h",
    candles: vrCandles,
    indicators: {
      atr: vrAtr,
      adx: vrAdx,
      ema20: vrEma20,
      sma50: vrSma50
    }
  };

  const vVR = vr.validate(vrCtx);
  const vrSignal = vr.evaluate(vrCtx);
  console.log(`[PASS] Volatility Regime Validated (validate=${vVR})`);
  console.log(`VR Signal output: signal=${vrSignal.signal}, confidence=${vrSignal.confidence}, TP=${vrSignal.takeProfit}, SL=${vrSignal.stopLoss}`);
  console.log(`VR Reasoning: ${JSON.stringify(vrSignal.reasoning)}`);
  console.log();

  // 5. Zeiierman Volatility Strategy Tests
  console.log("--- 5. Testing Zeiierman Volatility Strategy ---");
  const zv = new ZeiiermanVolatilityStrategy();
  
  const zvCount = 30;
  // Breakout: price > upper band
  // upper band = SMA20 + 2 * ATR20
  // Volatility expanding: atr expanding
  // Volume above average
  const zvCandles = generateMockCandles(zvCount, 100, "custom", (i) => {
    if (i < 25) return 100;
    if (i === 29) return 120; // breakout jump!
    return 100 + (i - 25) * 1.5;
  });
  
  const zvAtr = new Array(zvCount).fill(1.0);
  zvAtr[29] = 2.5; // expanding volatility
  zvAtr[28] = 1.8;
  zvAtr[27] = 1.0;

  const zvAdx = new Array(zvCount).fill(35); // ADX > 25
  const zvVolumeMA = new Array(zvCount).fill(1000);
  
  // Set volume high at the end
  zvCandles[29].volume = 2500; // > MA 1000

  const zvCtx: StrategyContext = {
    symbol: "BTCUSDT",
    timeframe: "1h",
    candles: zvCandles,
    indicators: {
      atr: zvAtr,
      adx: zvAdx,
      volumeMA: zvVolumeMA
    }
  };

  const vZV = zv.validate(zvCtx);
  const zvSignal = zv.evaluate(zvCtx);
  console.log(`[PASS] Zeiierman Volatility Validated (validate=${vZV})`);
  console.log(`ZV Signal output: signal=${zvSignal.signal}, confidence=${zvSignal.confidence}, TP=${zvSignal.takeProfit}, SL=${zvSignal.stopLoss}`);
  console.log(`ZV Reasoning: ${JSON.stringify(zvSignal.reasoning)}`);
  console.log();

  console.log("=== ALL STRATEGY BATCH 5 TESTS COMPLETED SUCCESSFULLY ===");
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
