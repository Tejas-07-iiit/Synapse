import prisma from "../lib/prisma";
import { PaperTradingEngine } from "../src/execution-engine/paper";
import { useWalletStore } from "../src/stores/walletStore";
import { useSettingsStore } from "../src/stores/settingsStore";
import { useAuthStore } from "../store/useAuthStore";

// Mock fetch to point to the running Next.js dev server on port 3001
const BASE_URL = "http://localhost:3001";
const originalFetch = globalThis.fetch;
globalThis.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
  let url = typeof input === "string" ? input : input.toString();
  if (url.startsWith("/")) {
    url = BASE_URL + url;
  }
  return originalFetch(url, init);
};

async function testLifecycle() {
  const userId = "test-verified-user-999";
  console.log(`\n=== Starting End-to-End Position Lock Audit for User: ${userId} ===\n`);

  try {
    // 1. Clean up database records for the test user to guarantee a clean state
    console.log("[TEST] Cleaning up previous test data in database...");
    await prisma.trade.deleteMany({ where: { userId } });
    await prisma.position.deleteMany({ where: { userId } });
    
    // Ensure the wallet is initialized or exists
    const wallet = await prisma.wallet.upsert({
      where: { userId },
      update: { balance: 10000, realizedPnl: 0 },
      create: { userId, balance: 10000, totalDeposited: 10000, realizedPnl: 0 },
    });
    console.log(`[TEST] Wallet balance initialized: $${wallet.balance}`);

    // 2. Initialize the Zustand stores in-memory for the test runner
    console.log("[TEST] Setting up client state stores...");
    useWalletStore.setState({
      balance: 10000,
      totalDeposited: 10000,
      realizedPnl: 0,
      loading: false,
      error: null,
    });

    useSettingsStore.setState({
      autoTrading: true,
      riskPerTradePct: 5.0, // 5% risk ($500 order value at 1x leverage)
      maxOpenTrades: 3,
      defaultSlPct: 2.0, // 2% Stop Loss
      defaultTpPct: 4.0, // 4% Take Profit
      prefTimeframe: "15m",
      prefSymbol: "BTCUSDT",
      loading: false,
      error: null,
    });

    useAuthStore.setState({
      user: { id: userId, username: "test_user", email: "test@synapse.ai" } as any,
    });

    // 3. Load active positions into PaperTradingEngine memory
    console.log("[TEST] Loading active positions from DB...");
    await PaperTradingEngine.loadActivePositions(userId);
    console.log("[TEST] Open positions in memory:", PaperTradingEngine.getOpenPositions().length);

    // 4. Try opening the FIRST position (BTCUSDT LONG)
    console.log("\n--- STEP 1: Open First BTCUSDT Position ---");
    const entryPrice = 50000;
    const sl = entryPrice * (1 - 0.02); // 49000
    const tp = entryPrice * (1 + 0.04); // 52000
    
    const pos1 = await PaperTradingEngine.openPosition(
      userId,
      "BTCUSDT",
      "LONG",
      entryPrice,
      null, // sizeUsdt (let size be calculated from riskPerTradePct)
      sl,
      tp,
      1 // leverage
    );

    if (!pos1) {
      throw new Error("Failed to open first BTCUSDT position");
    }
    console.log(`[TEST] SUCCESS: Opened BTCUSDT position! ID: ${pos1.id}, Qty: ${pos1.quantity.toFixed(4)}, Entry: $${pos1.entryPrice}`);

    // Verify memory count
    let openPositions = PaperTradingEngine.getOpenPositions();
    if (openPositions.length !== 1) {
      throw new Error(`Expected 1 open position in memory, got ${openPositions.length}`);
    }

    // 5. Try opening a SECOND position on the same symbol (BTCUSDT LONG)
    console.log("\n--- STEP 2: Attempt Duplicate BTCUSDT Position ---");
    const pos2 = await PaperTradingEngine.openPosition(
      userId,
      "BTCUSDT",
      "LONG",
      50500,
      null,
      sl,
      tp,
      1
    );

    if (pos2 !== null) {
      throw new Error("FAIL: Allowed a duplicate active position on BTCUSDT!");
    }
    console.log("[TEST] SUCCESS: Duplicate position block confirmed (returned null).");

    // 6. Try opening a position on a DIFFERENT symbol (ETHUSDT SHORT)
    console.log("\n--- STEP 3: Open ETHUSDT Position (Multi-coin test) ---");
    const ethEntryPrice = 3000;
    const ethSl = ethEntryPrice * (1 + 0.02); // 3060
    const ethTp = ethEntryPrice * (1 - 0.04); // 2880

    const ethPos = await PaperTradingEngine.openPosition(
      userId,
      "ETHUSDT",
      "SHORT",
      ethEntryPrice,
      null,
      ethSl,
      ethTp,
      1
    );

    if (!ethPos) {
      throw new Error("Failed to open ETHUSDT position");
    }
    console.log(`[TEST] SUCCESS: Opened ETHUSDT position! ID: ${ethPos.id}, Qty: ${ethPos.quantity.toFixed(4)}, Entry: $${ethPos.entryPrice}`);

    // Verify memory count is 2
    openPositions = PaperTradingEngine.getOpenPositions();
    if (openPositions.length !== 2) {
      throw new Error(`Expected 2 open positions in memory, got ${openPositions.length}`);
    }

    // 7. Simulate price update to hit Take Profit on BTCUSDT
    console.log("\n--- STEP 4: Simulate Price Trigger to Hit BTCUSDT TP ---");
    const targetTpPrice = 52100; // Above TP level of 52000
    console.log(`[TEST] Simulating BTCUSDT price update to $${targetTpPrice}...`);
    await PaperTradingEngine.updatePrices("BTCUSDT", targetTpPrice);

    // Give it a brief moment to complete async DB writes if any
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Verify BTCUSDT position is closed in memory
    openPositions = PaperTradingEngine.getOpenPositions();
    const btcPosStillOpen = openPositions.some((p) => p.symbol === "BTCUSDT");
    if (btcPosStillOpen) {
      throw new Error("FAIL: BTCUSDT position is still open in memory after price crossed TP.");
    }
    console.log("[TEST] SUCCESS: BTCUSDT position closed successfully in memory.");

    // Verify closed trade is in DB
    const closedBtcTrade = await prisma.trade.findFirst({
      where: { userId, symbol: "BTCUSDT", status: "TP HIT" },
    });
    if (!closedBtcTrade) {
      throw new Error("FAIL: Closed trade record not found in database or status is incorrect.");
    }
    console.log(`[TEST] SUCCESS: Database trade log verified! status: ${closedBtcTrade.status}, PnL: $${closedBtcTrade.pnl.toFixed(2)}, ROI: ${closedBtcTrade.roi.toFixed(2)}%`);

    // Verify wallet updated in DB
    const updatedWallet = await prisma.wallet.findUnique({ where: { userId } });
    console.log(`[TEST] Wallet balance in DB after TP hit: $${updatedWallet?.balance}`);

    // 8. Try opening BTCUSDT position AGAIN (should be allowed now)
    console.log("\n--- STEP 5: Re-open BTCUSDT Position (Unlocked Test) ---");
    const pos3 = await PaperTradingEngine.openPosition(
      userId,
      "BTCUSDT",
      "LONG",
      52500,
      null,
      52500 * 0.98,
      52500 * 1.04,
      1
    );

    if (!pos3) {
      throw new Error("FAIL: Failed to open BTCUSDT position after previous one was closed (lock was not released)");
    }
    console.log(`[TEST] SUCCESS: Re-opened BTCUSDT position! ID: ${pos3.id}, Entry: $${pos3.entryPrice}`);

    // Clean up all positions for user at the end of successful verification
    console.log("\n[TEST] Cleaning up test positions...");
    await prisma.position.deleteMany({ where: { userId } });
    await prisma.trade.deleteMany({ where: { userId } });
    console.log("\n=== ALL LIFECYCLE TESTS PASSED SUCCESSFULLY! ===\n");
    
  } catch (error) {
    console.error("\n[TEST] Lifecycle verification failed with error:", error);
    process.exit(1);
  }
}

testLifecycle();
