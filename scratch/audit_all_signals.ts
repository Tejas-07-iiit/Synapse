import fs from 'fs';
import path from 'path';

const replayFolders = [
    'src/replay/reports/replays/2026-05-26_04-29_to_2026-06-03_11-59_BTC_SOL_ETH_intraday_10d',
    'src/replay/reports/replays/2026-05-31_04-14_to_2026-06-03_12-59_BTC_SOL_ETH_intraday_5d',
    'src/replay/reports/replays/2026-06-01_04-29_to_2026-06-03_12-59_BTC_SOL_ETH_intraday_4d'
];

interface Trade {
    tradeNumber: string;
    symbol: string;
    timeframe: string;
    strategy: string;
    direction: string;
    entryPrice: number;
    exitPrice: number;
    positionSize: number;
    quantity: number;
    leverage: number;
    stopLoss: number;
    takeProfit: number;
    grossProfit: number;
    fees: number;
    netProfit: number;
    roi: number;
    duration: number;
    status: string;
    exitReason: string;
    openedAt: string;
    closedAt: string;
}

function parseCSV(content: string): Trade[] {
    const lines = content.trim().split('\n');
    const header = lines[0].split(',');
    return lines.slice(1).map(line => {
        const values = line.split(',');
        const trade: any = {};
        header.forEach((h, i) => {
            let val: any = values[i];
            if (!isNaN(val) && val !== '') {
                val = parseFloat(val);
            }
            const key = h.trim().replace('Trade Number', 'tradeNumber')
                         .replace('Symbol', 'symbol')
                         .replace('Timeframe', 'timeframe')
                         .replace('Strategy', 'strategy')
                         .replace('Direction', 'direction')
                         .replace('Entry Price', 'entryPrice')
                         .replace('Exit Price', 'exitPrice')
                         .replace('Position Size', 'positionSize')
                         .replace('Quantity', 'quantity')
                         .replace('Leverage', 'leverage')
                         .replace('Stop Loss', 'stopLoss')
                         .replace('Take Profit', 'takeProfit')
                         .replace('Gross Profit', 'grossProfit')
                         .replace('Fees', 'fees')
                         .replace('Net Profit', 'netProfit')
                         .replace('ROI', 'roi')
                         .replace('Duration (ms)', 'duration')
                         .replace('Status', 'status')
                         .replace('Exit Reason', 'exitReason')
                         .replace('Opened At', 'openedAt')
                         .replace('Closed At', 'closedAt');
            trade[key] = val;
        });
        return trade as Trade;
    });
}

const allTrades: Trade[] = [];
const tradeKeys = new Set<string>();

replayFolders.forEach(folder => {
    const filePath = path.join(folder, 'TradeHistory.csv');
    if (fs.existsSync(filePath)) {
        const trades = parseCSV(fs.readFileSync(filePath, 'utf-8'));
        trades.forEach(t => {
            const key = `${t.symbol}-${t.openedAt}-${t.strategy}`;
            if (!tradeKeys.has(key)) {
                tradeKeys.add(key);
                allTrades.push(t);
            }
        });
    }
});

console.log(`Total Unique Trades: ${allTrades.length}`);

// 1. Portfolio Analysis
const startingBalance = 10000;
const totalGrossProfit = allTrades.reduce((sum, t) => sum + t.grossProfit, 0);
const totalFees = allTrades.reduce((sum, t) => sum + t.fees, 0);
const totalNetProfit = allTrades.reduce((sum, t) => sum + t.netProfit, 0);
const wins = allTrades.filter(t => t.grossProfit > 0);
const losses = allTrades.filter(t => t.grossProfit <= 0);
const winRate = (wins.length / allTrades.length) * 100;
const grossProfitSum = wins.reduce((sum, t) => sum + t.grossProfit, 0);
const grossLossSum = Math.abs(losses.reduce((sum, t) => sum + t.grossProfit, 0));
const profitFactor = grossProfitSum / (grossLossSum || 1);

console.log('\n--- 1. Portfolio Analysis ---');
console.log(`Starting Balance: $${startingBalance}`);
console.log(`Ending Balance: $${(startingBalance + totalNetProfit).toFixed(2)}`);
console.log(`Net Profit: $${totalNetProfit.toFixed(2)}`);
console.log(`Total Fees: $${totalFees.toFixed(2)}`);
console.log(`Gross Profit before fees: $${totalGrossProfit.toFixed(2)}`);
console.log(`Win Rate: ${winRate.toFixed(2)}%`);
console.log(`Profit Factor: ${profitFactor.toFixed(2)}`);

// 2. Strategy Audit
const strategies: any = {};
allTrades.forEach(t => {
    if (!strategies[t.strategy]) {
        strategies[t.strategy] = { trades: 0, wins: 0, gross: 0, net: 0, fees: 0 };
    }
    strategies[t.strategy].trades++;
    if (t.grossProfit > 0) strategies[t.strategy].wins++;
    strategies[t.strategy].gross += t.grossProfit;
    strategies[t.strategy].net += t.netProfit;
    strategies[t.strategy].fees += t.fees;
});

console.log('\n--- 3. Strategy Audit ---');
Object.keys(strategies).forEach(s => {
    const stat = strategies[s];
    console.log(`${s}: Trades=${stat.trades}, WinRate=${(stat.wins/stat.trades*100).toFixed(2)}%, Gross=$${stat.gross.toFixed(2)}, Net=$${stat.net.toFixed(2)}, Fees=$${stat.fees.toFixed(2)}`);
});

// 3. Timeframe Audit
const timeframes: any = {};
allTrades.forEach(t => {
    if (!timeframes[t.timeframe]) {
        timeframes[t.timeframe] = { trades: 0, wins: 0, gross: 0, net: 0 };
    }
    timeframes[t.timeframe].trades++;
    if (t.grossProfit > 0) timeframes[t.timeframe].wins++;
    timeframes[t.timeframe].gross += t.grossProfit;
    timeframes[t.timeframe].net += t.netProfit;
});

console.log('\n--- 6. Timeframe Audit ---');
Object.keys(timeframes).forEach(tf => {
    const stat = timeframes[tf];
    console.log(`${tf}: Trades=${stat.trades}, WinRate=${(stat.wins/stat.trades*100).toFixed(2)}%, Net=$${stat.net.toFixed(2)}`);
});

// 4. Symbol Audit
const symbols: any = {};
allTrades.forEach(t => {
    if (!symbols[t.symbol]) {
        symbols[t.symbol] = { trades: 0, wins: 0, gross: 0, net: 0 };
    }
    symbols[t.symbol].trades++;
    if (t.grossProfit > 0) symbols[t.symbol].wins++;
    symbols[t.symbol].gross += t.grossProfit;
    symbols[t.symbol].net += t.netProfit;
});

console.log('\n--- 7. Symbol Audit ---');
Object.keys(symbols).forEach(sym => {
    const stat = symbols[sym];
    console.log(`${sym}: Trades=${stat.trades}, WinRate=${(stat.wins/stat.trades*100).toFixed(2)}%, Net=$${stat.net.toFixed(2)}`);
});
