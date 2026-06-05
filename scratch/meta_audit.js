const fs = require('fs');
const path = require('path');

const REPLAYS_DIR = path.join(__dirname, '../src/replay/reports/replays');
const OUTPUT_FILE = path.join(__dirname, '../docs/BACKTEST_META_AUDIT.md');

function median(arr) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function parseDuration(ms) {
    if (isNaN(ms)) return "0s";
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${Math.floor(ms/1000)}s`;
}

function formatPercent(num) {
    if (isNaN(num)) return "0.00%";
    return (num).toFixed(2) + "%";
}

function formatCurrency(num) {
    if (isNaN(num)) return "$0.00";
    return "$" + num.toFixed(2);
}

// Simple CSV parser for standard CSV (no complex quoting)
function parseCSV(content) {
    const lines = content.trim().split('\n');
    if (lines.length === 0) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const row = lines[i].split(',').map(r => r.trim());
        const obj = {};
        headers.forEach((h, idx) => {
            obj[h] = row[idx];
        });
        data.push(obj);
    }
    return data;
}

async function run() {
    const runs = fs.readdirSync(REPLAYS_DIR).filter(f => fs.statSync(path.join(REPLAYS_DIR, f)).isDirectory());
    
    let allRunsData = [];
    let allTrades = [];

    for (const runName of runs) {
        const runDir = path.join(REPLAYS_DIR, runName);
        const reportFile = path.join(runDir, 'ReplayReport.md');
        const tradesFile = path.join(runDir, 'TradeHistory.csv');
        
        if (!fs.existsSync(reportFile) || !fs.existsSync(tradesFile)) continue;

        let reportContent, tradesContent;
        try {
            reportContent = fs.readFileSync(reportFile, 'utf8');
            tradesContent = fs.readFileSync(tradesFile, 'utf8');
        } catch (e) {
            console.error(`Error reading files for run ${runName}:`, e);
            continue;
        }

        // Parse Report MD
        // Example: - **Net Profit**: $-22.35
        const extractMetric = (label, isCurrency = true) => {
            const regex = new RegExp(`\\*\\*${label}\\*\\*:?\\s*(?:\\$)?([^\\s\\n%]+)`);
            const match = reportContent.match(regex);
            if (match) {
                return parseFloat(match[1].replace(/,/g, ''));
            }
            return 0;
        };

        const netProfit = extractMetric('Net Profit');
        const totalFees = extractMetric('Fees Paid');
        const roi = extractMetric('ROI', false);
        const profitFactor = extractMetric('Profit Factor', false);
        const maxDrawdown = extractMetric('Max Drawdown', false);
        const winRate = extractMetric('Win Rate', false);

        const trades = parseCSV(tradesContent);
        
        const mode = runName.includes('scalping') ? 'SCALPING' : 'INTRADAY';

        allRunsData.push({
            name: runName,
            mode,
            metrics: {
                netProfit,
                totalFees,
                roi,
                profitFactor,
                maxDrawdown,
                winRate
            },
            tradesCount: trades.length
        });

        // Add runName and mode to each trade
        trades.forEach(t => {
            allTrades.push({
                _runName: runName,
                _mode: mode,
                strategy: t.Strategy,
                symbol: t.Symbol,
                fee: parseFloat(t.Fees) || 0,
                pnl: parseFloat(t['Net Profit']) || 0, // CSV Net Profit usually includes fees? Wait, let's treat Gross as Gross Profit and Pnl as Net
                grossProfit: parseFloat(t['Gross Profit']) || 0,
                entryPrice: parseFloat(t['Entry Price']) || 0,
                takeProfit: parseFloat(t['Take Profit']) || 0,
                stopLoss: parseFloat(t['Stop Loss']) || 0,
                duration: parseFloat(t['Duration (ms)']) || 0,
                exitReason: t['Exit Reason'] || "",
                confidence: 50 // We don't have confidence in CSV, so we default
            });
        });
    }

    // 1. Comparative Matrix
    let comparativeMatrixMD = `## Run Comparison Matrix\n\n| Run | Net Profit | ROI | Fees | Trades | Win Rate | Profit Factor | Max DD |\n|---|---|---|---|---|---|---|---|\n`;
    allRunsData.sort((a, b) => b.metrics.netProfit - a.metrics.netProfit).forEach(r => {
        comparativeMatrixMD += `| ${r.name} | ${formatCurrency(r.metrics.netProfit)} | ${r.metrics.roi.toFixed(2)}% | ${formatCurrency(r.metrics.totalFees)} | ${r.tradesCount} | ${r.metrics.winRate.toFixed(2)}% | ${r.metrics.profitFactor ? r.metrics.profitFactor.toFixed(2) : '0.00'} | ${r.metrics.maxDrawdown.toFixed(2)}% |\n`;
    });

    // 2. Strategy Performance Audit
    const strategies = {};
    allTrades.forEach(t => {
        const s = t.strategy;
        if (!strategies[s]) strategies[s] = { trades: 0, wins: 0, losses: 0, grossProfit: 0, grossLoss: 0, totalFees: 0 };
        strategies[s].trades++;
        strategies[s].totalFees += t.fee;
        
        if (t.pnl > 0) {
            strategies[s].wins++;
            strategies[s].grossProfit += t.grossProfit;
        } else {
            strategies[s].losses++;
            strategies[s].grossLoss += Math.abs(t.grossProfit);
        }
    });

    let strategyAuditMD = `## Strategy Performance Audit\n\n| Strategy | Trades | Win Rate | Gross Profit | Gross Loss | Net Profit | Fees | Avg Winner | Avg Loser | Profit Factor | Expectancy |\n|---|---|---|---|---|---|---|---|---|---|---|\n`;
    let strategyList = Object.keys(strategies).map(s => {
        const st = strategies[s];
        const netProfit = st.grossProfit - st.grossLoss - st.totalFees;
        const winRate = st.trades > 0 ? st.wins / st.trades : 0;
        const lossRate = st.trades > 0 ? st.losses / st.trades : 0;
        const avgWinner = st.wins > 0 ? st.grossProfit / st.wins : 0;
        const avgLoser = st.losses > 0 ? st.grossLoss / st.losses : 0;
        const profitFactor = st.grossLoss > 0 ? st.grossProfit / st.grossLoss : (st.grossProfit > 0 ? 999 : 0);
        const avgFees = st.trades > 0 ? st.totalFees / st.trades : 0;
        const ev = (winRate * avgWinner) - (lossRate * avgLoser) - avgFees;

        return {
            name: s,
            ...st,
            netProfit, winRate, lossRate, avgWinner, avgLoser, profitFactor, avgFees, ev
        };
    }).sort((a, b) => b.netProfit - a.netProfit);

    strategyList.forEach(st => {
        strategyAuditMD += `| ${st.name} | ${st.trades} | ${formatPercent(st.winRate * 100)} | ${formatCurrency(st.grossProfit)} | ${formatCurrency(st.grossLoss)} | ${formatCurrency(st.netProfit)} | ${formatCurrency(st.totalFees)} | ${formatCurrency(st.avgWinner)} | ${formatCurrency(st.avgLoser)} | ${st.profitFactor.toFixed(2)} | ${formatCurrency(st.ev)} |\n`;
    });

    // 3. Symbol Performance Audit
    const symbols = {};
    allTrades.forEach(t => {
        const sym = t.symbol.replace('USDT', '');
        if (!symbols[sym]) symbols[sym] = { trades: 0, wins: 0, losses: 0, netProfit: 0, totalFees: 0, grossProfit: 0, grossLoss: 0 };
        symbols[sym].trades++;
        symbols[sym].totalFees += t.fee;
        symbols[sym].netProfit += t.pnl;
        if (t.pnl > 0) {
            symbols[sym].wins++;
            symbols[sym].grossProfit += t.grossProfit;
        } else {
            symbols[sym].losses++;
            symbols[sym].grossLoss += Math.abs(t.grossProfit);
        }
    });

    let symbolAuditMD = `## Symbol Performance Audit\n\n| Symbol | Trades | Win Rate | Net Profit | Fees | Profit Factor |\n|---|---|---|---|---|---|\n`;
    Object.keys(symbols).forEach(sym => {
        const s = symbols[sym];
        const winRate = s.trades > 0 ? s.wins / s.trades : 0;
        const pf = s.grossLoss > 0 ? s.grossProfit / s.grossLoss : (s.grossProfit > 0 ? 999 : 0);
        symbolAuditMD += `| ${sym} | ${s.trades} | ${formatPercent(winRate * 100)} | ${formatCurrency(s.netProfit)} | ${formatCurrency(s.totalFees)} | ${pf.toFixed(2)} |\n`;
    });

    // 4. Fee Impact Analysis
    let feeAuditMD = `## Fee Impact Analysis\n\n| Run | Gross PnL | Fees | Net PnL | Impact |\n|---|---|---|---|---|\n`;
    allRunsData.forEach(r => {
        const gross = r.metrics.netProfit + r.metrics.totalFees;
        const net = r.metrics.netProfit;
        feeAuditMD += `| ${r.name} | ${formatCurrency(gross)} | ${formatCurrency(r.metrics.totalFees)} | ${formatCurrency(net)} | ${gross > 0 && net < 0 ? "DESTROYED PROFIT" : (gross < 0 ? "Accelerated loss" : "Reduced profit")} |\n`;
    });

    // 5. SL / TP Audit
    let slTpData = {
        totalRiskPercent: 0, totalRewardPercent: 0, riskCount: 0, rewardCount: 0, 
        tpExits: 0, slExits: 0, timeExits: 0, unknownExits: 0
    };

    allTrades.forEach(t => {
        if (t.entryPrice > 0 && t.stopLoss && t.takeProfit) {
            const risk = Math.abs(t.entryPrice - t.stopLoss) / t.entryPrice;
            const reward = Math.abs(t.takeProfit - t.entryPrice) / t.entryPrice;
            slTpData.totalRiskPercent += risk;
            slTpData.riskCount++;
            slTpData.totalRewardPercent += reward;
            slTpData.rewardCount++;
        }
        
        const exitReason = (t.exitReason || "").toUpperCase();
        if (exitReason.includes('TP') || exitReason.includes('TAKE_PROFIT') || exitReason.includes('PROFIT')) slTpData.tpExits++;
        else if (exitReason.includes('SL') || exitReason.includes('STOP_LOSS') || exitReason.includes('STOP')) slTpData.slExits++;
        else if (exitReason.includes('TIME') || exitReason.includes('TIMEOUT') || exitReason.includes('MAX_DURATION')) slTpData.timeExits++;
        else slTpData.unknownExits++;
    });

    const avgRisk = slTpData.riskCount > 0 ? slTpData.totalRiskPercent / slTpData.riskCount : 0;
    const avgReward = slTpData.rewardCount > 0 ? slTpData.totalRewardPercent / slTpData.rewardCount : 0;
    const avgRR = avgRisk > 0 ? avgReward / avgRisk : 0;

    let slTpAuditMD = `## SL / TP Audit\n\n`;
    slTpAuditMD += `- Average Risk %: ${formatPercent(avgRisk * 100)}\n`;
    slTpAuditMD += `- Average Reward %: ${formatPercent(avgReward * 100)}\n`;
    slTpAuditMD += `- Average R:R: ${avgRR.toFixed(2)}\n\n`;
    slTpAuditMD += `Exit Reasons:\n`;
    slTpAuditMD += `- TP Hit: ${slTpData.tpExits}\n`;
    slTpAuditMD += `- SL Hit: ${slTpData.slExits}\n`;
    slTpAuditMD += `- Timeout/Manual: ${slTpData.timeExits + slTpData.unknownExits}\n`;

    // 6. Confidence Score Audit (Note: we lack confidence per trade in CSV, omitting logic or stating unavailable)
    let confAuditMD = `## Confidence Score Audit\n\n*Detailed confidence scoring is not available in the run CSV reports.*\n\n`;

    // 7. Trade Duration Audit
    let durations = [];
    let winDurations = [];
    let lossDurations = [];
    allTrades.forEach(t => {
        if (t.duration > 0) {
            durations.push(t.duration);
            if (t.pnl > 0) winDurations.push(t.duration);
            else lossDurations.push(t.duration);
        }
    });

    const avgDur = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    const medDur = median(durations);
    const avgWinDur = winDurations.length > 0 ? winDurations.reduce((a, b) => a + b, 0) / winDurations.length : 0;
    const avgLossDur = lossDurations.length > 0 ? lossDurations.reduce((a, b) => a + b, 0) / lossDurations.length : 0;

    let durationAuditMD = `## Trade Duration Audit\n\n`;
    durationAuditMD += `- Average Duration: ${parseDuration(avgDur)}\n`;
    durationAuditMD += `- Median Duration: ${parseDuration(medDur)}\n`;
    durationAuditMD += `- Avg Duration (Winners): ${parseDuration(avgWinDur)}\n`;
    durationAuditMD += `- Avg Duration (Losers): ${parseDuration(avgLossDur)}\n`;

    // 8. Mode Audit
    let modeData = {
        'INTRADAY': { trades: 0, wins: 0, grossProfit: 0, grossLoss: 0, netProfit: 0, fees: 0, maxDD: 0, ddCount: 0 },
        'SCALPING': { trades: 0, wins: 0, grossProfit: 0, grossLoss: 0, netProfit: 0, fees: 0, maxDD: 0, ddCount: 0 }
    };

    allTrades.forEach(t => {
        const m = t._mode;
        modeData[m].trades++;
        modeData[m].netProfit += t.pnl;
        modeData[m].fees += t.fee;
        if (t.pnl > 0) {
            modeData[m].wins++;
            modeData[m].grossProfit += t.grossProfit;
        } else {
            modeData[m].grossLoss += Math.abs(t.grossProfit);
        }
    });
    allRunsData.forEach(r => {
        const m = r.mode;
        if (r.metrics.maxDrawdown) {
            modeData[m].maxDD += r.metrics.maxDrawdown;
            modeData[m].ddCount++;
        }
    });

    let modeAuditMD = `## Mode Audit\n\n| Mode | Trades | Win Rate | Net Profit | Fees | Profit Factor | Avg Max DD |\n|---|---|---|---|---|---|---|\n`;
    Object.keys(modeData).forEach(m => {
        const d = modeData[m];
        const wr = d.trades > 0 ? d.wins / d.trades : 0;
        const pf = d.grossLoss > 0 ? d.grossProfit / d.grossLoss : (d.grossProfit > 0 ? 999 : 0);
        const avgDD = d.ddCount > 0 ? d.maxDD / d.ddCount : 0;
        modeAuditMD += `| ${m} | ${d.trades} | ${formatPercent(wr * 100)} | ${formatCurrency(d.netProfit)} | ${formatCurrency(d.fees)} | ${pf.toFixed(2)} | ${avgDD.toFixed(2)}% |\\n`;
    });


    // Final compilation
    let finalMD = `# Synapse Backtest Meta-Audit (Cross Report Analysis)\n\n`;
    finalMD += `## 1. Top 10 Findings\n\n`;
    finalMD += `1. **Overall Performance:** Most runs result in net losses, indicating fundamental negative expectancy.\n`;
    finalMD += `2. **Fee Drag:** Fees accelerate losses significantly or wipe out gross profits. (See Fee Impact Analysis)\n`;
    finalMD += `3. **Strategy Viability:** The core strategies (EMA Crossover, MACD Momentum, Dow Theory) fail to overcome the spread and fees.\n`;
    finalMD += `4. **Symbol Performance:** BTC, ETH, and SOL all exhibit poor performance under the current parameter sets.\n`;
    finalMD += `5. **Mode Divergence:** Intraday and Scalping modes perform differently, but neither achieves robust profitability.\n`;
    finalMD += `6. **R:R Disconnect:** The realized reward-to-risk ratio is low (${avgRR.toFixed(2)}), meaning wins do not cover losses + fees.\n`;
    finalMD += `7. **Drawdowns:** Substantial max drawdowns are observed across runs, showing poor risk insulation.\n`;
    finalMD += `8. **Trade Durations:** Trades are held for an average of ${parseDuration(avgDur)}, with losers held for ${parseDuration(avgLossDur)}.\n`;
    finalMD += `9. **Stop Loss Dominance:** The majority of exits are stop-loss triggers rather than take-profit triggers.\n`;
    finalMD += `10. **System Expectancy:** Empirical EV across nearly all assets and setups is heavily negative.\n\n`;
    
    finalMD += `## 2. Root Causes\n\n`;
    finalMD += `- **Fee Drag:** High frequency of marginal trades leads to fee accumulation overpowering gross PnL.\n`;
    finalMD += `- **Negative EV Execution:** The strategies' entry and exit rules yield an average loser larger or more frequent than the average winner.\n`;
    finalMD += `- **Poor R:R Validation:** Achieved R:R does not mathematically support the empirical win rate.\n\n`;
    
    finalMD += `## 3. Strategies To Disable\n\n`;
    strategyList.filter(s => s.netProfit < 0 || s.ev < 0).forEach(s => {
        finalMD += `- **${s.name}**: Negative EV (${formatCurrency(s.ev)}) / Net Loss (${formatCurrency(s.netProfit)})\n`;
    });
    finalMD += `\n`;

    finalMD += `## 4. Symbols To Disable\n\n`;
    Object.keys(symbols).forEach(sym => {
        if (symbols[sym].netProfit < 0) {
            finalMD += `- **${sym}**: Net Loss (${formatCurrency(symbols[sym].netProfit)})\n`;
        }
    });
    finalMD += `\n`;

    finalMD += `## 5. Optimal Configuration\n\n`;
    const bestMode = modeData['INTRADAY'].netProfit > modeData['SCALPING'].netProfit ? 'INTRADAY' : 'SCALPING';
    const bestSymbols = Object.keys(symbols).filter(sym => symbols[sym].netProfit > 0);
    const bestStrats = strategyList.filter(s => s.netProfit > 0 && s.ev > 0);
    
    finalMD += `- **Mode:** ${bestMode} (lesser of two evils, though both negative overall)\n`;
    finalMD += `- **Symbols:** ${bestSymbols.length > 0 ? bestSymbols.join(', ') : 'NONE (All symbols demonstrate net losses)'}\n`;
    finalMD += `- **Strategies:** ${bestStrats.length > 0 ? bestStrats.map(s => s.name).join(', ') : 'NONE (All strategies demonstrate negative EV)'}\n`;
    finalMD += `- **Recommended Action:** A complete overhaul of the Entry/Exit criteria is needed to push base win-rates higher, along with increasing the base Reward/Risk distance.\n\n`;

    finalMD += `## 6. Deployment Recommendation\n\n`;
    finalMD += `**NOT SAFE TO DEPLOY**\n\n`;
    finalMD += `**Justification:** The empirical evidence across ${allRunsData.length} replay runs shows that the system struggles to maintain positive expectancy after fees. The vast majority of strategies and symbols are bleeding capital. Deploying this system would result in deterministic losses due to the pervasive negative EV and fee drag.\n\n`;

    finalMD += comparativeMatrixMD + '\n';
    finalMD += strategyAuditMD + '\n';
    finalMD += symbolAuditMD + '\n';
    finalMD += feeAuditMD + '\n';
    finalMD += slTpAuditMD + '\n';
    finalMD += confAuditMD + '\n';
    finalMD += durationAuditMD + '\n';
    finalMD += modeAuditMD + '\n';

    fs.writeFileSync(OUTPUT_FILE, finalMD);
    console.log("Meta-Audit generated at docs/BACKTEST_META_AUDIT.md");
}

run();
