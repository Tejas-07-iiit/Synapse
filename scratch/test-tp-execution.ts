import { PaperTradingEngine } from "../src/execution-engine/paper";

async function test() {
  const userId = "test-user";
  const sym = "SOLUSDT";

  // Simulate open position
  await PaperTradingEngine.openPosition(
    userId,
    sym,
    "SHORT",
    100, // Entry
    100, // Size
    110, // SL
    90,  // TP
    1,
    1000 // Balance
  );

  console.log("\n[TEST] Feeding standard prices (no wick):");
  await PaperTradingEngine.updatePrices(sym, 99);
  await PaperTradingEngine.updatePrices(sym, 95);
  await PaperTradingEngine.updatePrices(sym, 92);
  
  console.log("\n[TEST] Feeding wick: Close is 92, but wick went to 89. TP is 90.");
  // The system currently only accepts currentPrice. If we pass the close of the wick (e.g. 92):
  await PaperTradingEngine.updatePrices(sym, 92);
  
  console.log("\n[TEST] Checking position state:");
  const pos = PaperTradingEngine.getOpenPositions().find(p => p.symbol === sym);
  if (pos) {
    console.log(`❌ FAILED: Position is still OPEN at $${pos.currentPrice}. TP of 90 was ignored because currentPrice (close) never went <= 90.`);
  } else {
    console.log("✅ PASSED: Position closed.");
  }
}

test();
