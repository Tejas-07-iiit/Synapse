const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/replay/market-replayer.ts');
let content = fs.readFileSync(filePath, 'utf-8');

const targetStr = `        // Run consensus
        const consensusResult = ConsensusEngine.evaluate(signals, regime);`;

const newStr = `        // --- PRE-CONSENSUS STRICT FILTERING ---
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

        if (eligibleSignals.length === 0 && signals.length > 0) {
            tradeRecorder.logRejectedConsensus(); // Using existing method as closest equivalent for no eligible signals
            return;
        }

        // Run consensus
        const consensusResult = ConsensusEngine.evaluate(eligibleSignals, regime);`;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, newStr);
    fs.writeFileSync(filePath, content);
    console.log("Patched market-replayer.ts successfully.");
} else {
    console.log("Could not find the target string to patch.");
}
