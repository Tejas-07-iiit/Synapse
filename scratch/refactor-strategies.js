const fs = require("fs");
const path = require("path");

const STRATEGY_CATEGORIES = {
  "ema-crossover": "Trend Following",
  "rsi-reversal": "Reversal",
  "macd-momentum": "Momentum",
  "bollinger-breakout": "Breakout",
  "mean-reversion": "Mean-Reversion",
  "momentum": "Momentum",
  "defensive": "Defensive",
  "grid": "Grid",
  "lorentzian": "Lorentzian",
  "donchian-breakout": "Breakout",
  "rally-base-drop": "SupplyDemand",
  "sr-sweep": "LiquiditySweep",
  "bollinger-reversion": "MeanReversion",
  "short-term-reversal": "Reversal",
  "dow-mfi-rsi": "Momentum",
  "parabolic-rsi": "Momentum",
  "range-breakout-high": "Breakout",
  "residual-momentum": "Momentum",
  "time-series-momentum": "Momentum",
  "wavetrend": "Momentum",
  "hash-ribbons": "Sentiment",
  "news-fear-greed": "Sentiment",
  "ema-cross-adx": "Trend Following",
  "golden-cross": "Trend Following",
  "heiken-ashi-swing": "Trend Following",
  "hyper-supertrend": "Trend Following",
  "ichimoku-cloud": "Trend Following",
  "ma-crossover-var": "Trend Following",
  "sma-trend-filter": "Trend Following",
  "t3-nexus": "Trend Following",
  "squeeze-momentum": "Volatility",
  "volatility-regime": "Volatility",
  "zeiierman-volatility": "Volatility",
};

const STRATEGIES_DIR = "/home/tejas-ambaliya/Desktop/Synapse1/src/strategy-engine/strategies";

function run() {
  const folders = fs.readdirSync(STRATEGIES_DIR).filter(f => {
    return fs.statSync(path.join(STRATEGIES_DIR, f)).isDirectory();
  });

  for (const folder of folders) {
    const filePath = path.join(STRATEGIES_DIR, folder, "index.ts");
    if (!fs.existsSync(filePath)) continue;

    let content = fs.readFileSync(filePath, "utf8");

    // 1. Read strategy ID from file
    const idMatch = content.match(/public\s+id\s*=\s*["']([^"']+)["']/);
    if (!idMatch) {
      console.log(`[Warning] No strategy ID found in ${folder}`);
      continue;
    }
    const id = idMatch[1];
    const category = STRATEGY_CATEGORIES[id] || "Trend Following";

    // 2. Map category to supported regimes
    let regimes = [];
    if (category === "Trend Following" || category === "Sentiment" || category === "Defensive" || category === "Lorentzian") {
      regimes = ["Bullish Trend", "Bearish Trend", "Breakout", "High Volatility"];
    } else if (category === "Reversal" || category === "Mean-Reversion" || category === "MeanReversion" || category === "Grid") {
      regimes = ["Ranging", "Accumulation", "Distribution", "Low Volatility"];
    } else if (category === "Breakout" || category === "Volatility" || category === "Momentum") {
      regimes = ["Breakout", "High Volatility", "Bullish Trend", "Bearish Trend"];
    } else if (category === "SupplyDemand" || category === "LiquiditySweep") {
      regimes = ["Ranging", "Accumulation", "Distribution", "Low Volatility", "Breakout", "High Volatility"];
    } else {
      regimes = ["Bullish Trend", "Bearish Trend", "Ranging", "Accumulation", "Distribution", "Low Volatility", "Breakout", "High Volatility"];
    }

    const regimesStr = `public supportedRegimes = ${JSON.stringify(regimes)};`;

    // 3. Inject supportedRegimes if missing
    if (!content.includes("public supportedRegimes")) {
      // Find insertion point, e.g. after indicatorsRequired
      const insertAnchor = /public\s+indicatorsRequired\s*=\s*\[[^\]]*\];?/;
      const anchorMatch = content.match(insertAnchor);
      if (anchorMatch) {
        content = content.replace(insertAnchor, `${anchorMatch[0]}\n  ${regimesStr}`);
      } else {
        // Fallback after public enabled = true;
        const fallbackAnchor = /public\s+enabled\s*=\s*true;?/;
        const fallbackMatch = content.match(fallbackAnchor);
        if (fallbackMatch) {
          content = content.replace(fallbackAnchor, `${fallbackMatch[0]}\n  ${regimesStr}`);
        } else {
          console.log(`[Warning] Could not find anchor to inject supportedRegimes in ${id}`);
        }
      }
    }

    // 4. Resolve continuous re-entry bugs for target strategies
    if (id === "ema-cross-adx") {
      const lookbackBlock = /let\s+freshBullishCross\s*=\s*bullishCross;[\s\S]*?if\s*\(!freshBullishCross\s*&&\s*!freshBearishCross\)[\s\S]*?\}\s*\}/;
      if (content.match(lookbackBlock)) {
        content = content.replace(lookbackBlock, `const freshBullishCross = bullishCross;\n    const freshBearishCross = bearishCross;`);
        console.log(`[Refactor] Removed lookback loop from ${id}`);
      }
    }

    if (id === "golden-cross") {
      const lookbackBlock = /\/\/\s*Fresh\s+crossover\s+within\s+5\s+candles[\s\S]*?if\s*\(!freshBullishCross\s*&&\s*!freshBearishCross\)[\s\S]*?\}\s*\}/;
      if (content.match(lookbackBlock)) {
        content = content.replace(lookbackBlock, `// Fresh crossover\n    const freshBullishCross = bullishCross;\n    const freshBearishCross = bearishCross;`);
        console.log(`[Refactor] Removed lookback loop from ${id}`);
      }
    }

    if (id === "ma-crossover-var") {
      const lookbackBlock = /\/\/\s*Check\s+within\s+5\s+candles[\s\S]*?if\s*\(!freshBullishCross\s*&&\s*!freshBearishCross\)[\s\S]*?\}\s*\}/;
      if (content.match(lookbackBlock)) {
        content = content.replace(lookbackBlock, `// Fresh crossover\n    const freshBullishCross = bullishCross;\n    const freshBearishCross = bearishCross;`);
        console.log(`[Refactor] Removed lookback loop from ${id}`);
      }
    }

    if (id === "squeeze-momentum") {
      // Replace squeezeLookback loop
      const lookbackBlock = /\/\/\s*Track\s+squeeze\s+history[\s\S]*?break;\s*\}\s*\}/;
      if (content.match(lookbackBlock)) {
        const replacement = `// Squeeze release check\n    const squeezeRelease = squeezeOn[lastIdx - 1] === true && squeezeOn[lastIdx] === false;\n    const releaseAgo = 0;`;
        content = content.replace(lookbackBlock, replacement);
        console.log(`[Refactor] Removed lookback loop from ${id}`);
      }
    }

    if (id === "hash-ribbons") {
      // Replace recovery phase continuous trigger
      const triggerBlock = /\/\/\s*---\s*LONG:\s*Recovery\s+crossover\s+detected\s*---[\s\S]*?reasoning\.push\(`Recovery\s+strength:[\s\S]*?\)\s*;\s*\}/;
      if (content.match(triggerBlock)) {
        const replacement = `// --- LONG: Recovery crossover detected ---\n    if (isBullishCross) {\n      direction = "LONG";\n      reasoning.push("Hash Ribbons LONG: Hashrate SMA30 crossed above SMA60 — miner recovery signal.");\n      reasoning.push(\`Capitulation lasted \${capitulationDuration} candles.\`);\n      reasoning.push(\`Recovery strength: \${(recoveryStrength * 100).toFixed(2)}%.\`);\n    }`;
        content = content.replace(triggerBlock, replacement);
        console.log(`[Refactor] Fixed continuous entry in ${id}`);
      }
    }

    if (id === "bollinger-breakout") {
      const longAnchor = "const isBbLong = close > bbUpper;";
      const shortAnchor = "const isBbShort = close < bbLower;";
      if (content.includes(longAnchor) && content.includes(shortAnchor)) {
        content = content.replace(longAnchor, `const prevClose = lastIdx > 0 ? candles[lastIdx - 1].close : close;\n    const prevBbUpper = lastIdx > 0 ? indicators.bbUpper[lastIdx - 1] : bbUpper;\n    const isBbLong = prevClose <= prevBbUpper && close > bbUpper;`);
        content = content.replace(shortAnchor, `const prevBbLower = lastIdx > 0 ? indicators.bbLower[lastIdx - 1] : bbLower;\n    const isBbShort = prevClose >= prevBbLower && close < bbLower;`);
        console.log(`[Refactor] Converted Bollinger Breakout to discrete events`);
      }
    }

    if (id === "donchian-breakout") {
      // Replace closedAboveChannel / closedBelowChannel to trigger only on crossover
      const setupBlock = /const\s+closedAboveChannel\s*=\s*close\s*>\s*prevUpper;\s*const\s+closedBelowChannel\s*=\s*close\s*<\s*prevLower;/;
      if (content.match(setupBlock)) {
        const replacement = `const prevClose = lastIdx > 0 ? candles[lastIdx - 1].close : close;\n    const closedAboveChannel = prevClose <= prevUpper && close > prevUpper;\n    const closedBelowChannel = prevClose >= prevLower && close < prevLower;`;
        content = content.replace(setupBlock, replacement);
        console.log(`[Refactor] Converted Donchian Breakout to discrete events`);
      }
    }

    fs.writeFileSync(filePath, content, "utf8");
    console.log(`[Success] Processed ${id}`);
  }
}

run();
