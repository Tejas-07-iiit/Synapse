import { USER_MODE_CATEGORY_MAP } from "../src/strategy-engine/core/consensus-engine";

function testFiltering(userMode: string, signals: any[]) {
    let allowedTimeframes: string[] = [];
    let allowedCategories: string[] = [];
    if (userMode === "SCALPING") {
        allowedTimeframes = ["1m", "3m", "5m"];
        allowedCategories = ["SCALPING"];
    } else if (userMode === "INTRADAY") {
        allowedTimeframes = ["15m", "30m"];
        allowedCategories = ["INTRADAY", "DEFENSIVE"];
    }

    const eligibleSignals = signals.filter(sig => {
        const category = (sig.consensusCategory || sig.strategyCategory || "").toUpperCase();
        const timeframeAllowed = allowedTimeframes.includes(sig.timeframe.toLowerCase());
        const categoryAllowed = allowedCategories.includes(category);
        return timeframeAllowed && categoryAllowed;
    });

    console.log(`\nTesting Mode: ${userMode}`);
    console.log(`Allowed Categories: ${allowedCategories}`);
    console.log(`Allowed Timeframes: ${allowedTimeframes}`);
    console.log("Results:");
    
    signals.forEach(sig => {
        const passed = eligibleSignals.includes(sig);
        console.log(`  - [${sig.timeframe}] ${sig.strategyCategory} -> ${passed ? 'ACCEPTED' : 'REJECTED'}`);
    });
}

const mockSignals = [
    { timeframe: "1m", strategyCategory: "SCALPING" },
    { timeframe: "5m", strategyCategory: "SCALPING" },
    { timeframe: "15m", strategyCategory: "SCALPING" },
    { timeframe: "15m", strategyCategory: "INTRADAY" },
    { timeframe: "15m", strategyCategory: "DEFENSIVE" },
    { timeframe: "30m", strategyCategory: "DEFENSIVE" },
    { timeframe: "1h", strategyCategory: "DEFENSIVE" },
];

console.log("=== TRADING MODE ISOLATION & TIMEFRAME ISOLATION VERIFICATION ===");
testFiltering("SCALPING", mockSignals);
testFiltering("INTRADAY", mockSignals);
