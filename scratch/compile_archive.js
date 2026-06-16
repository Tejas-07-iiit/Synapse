const fs = require('fs');
const path = require('path');

const REPLAYS_DIR = path.join(__dirname, '../src/replay/reports/replays');
const CACHE_DIR = path.join(__dirname, '../src/replay/cache');
const OUTPUT_FILE = path.join(__dirname, '../docs/MASTER_BACKTEST_ARCHIVE.json');

async function compile() {
    console.log("Starting compilation of master archive...");
    const out = fs.createWriteStream(OUTPUT_FILE, { encoding: 'utf8' });
    
    out.write('{\n  "replays": [\n');
    
    const runs = fs.readdirSync(REPLAYS_DIR).filter(f => fs.statSync(path.join(REPLAYS_DIR, f)).isDirectory());
    
    for (let i = 0; i < runs.length; i++) {
        const runName = runs[i];
        const runDir = path.join(REPLAYS_DIR, runName);
        
        const runObj = {
            id: runName,
            metadata: loadJsonSafe(path.join(runDir, 'ReplayMetadata.json')),
            settings: loadJsonSafe(path.join(runDir, 'SettingsSnapshot.json')),
            portfolioCurve: loadJsonSafe(path.join(runDir, 'PortfolioCurve.json')),
            tradeDetails: loadJsonSafe(path.join(runDir, 'TradeDetails.json')),
            tradeHistoryCsv: loadTextSafe(path.join(runDir, 'TradeHistory.csv')),
            strategyLeaderboardCsv: loadTextSafe(path.join(runDir, 'StrategyLeaderboard.csv')),
            reportMd: loadTextSafe(path.join(runDir, 'ReplayReport.md'))
        };
        
        const runJson = JSON.stringify(runObj, null, 2);
        out.write(runJson);
        
        if (i < runs.length - 1) {
            out.write(',\n');
        } else {
            out.write('\n');
        }
    }
    
    out.write('  ],\n  "candles": {\n');
    
    if (fs.existsSync(CACHE_DIR)) {
        const candleFiles = fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.json'));
        for (let i = 0; i < candleFiles.length; i++) {
            const cFile = candleFiles[i];
            out.write(`    "${cFile}": `);
            
            // Read and pipe the candle JSON directly to avoid massive memory spikes
            const cData = fs.readFileSync(path.join(CACHE_DIR, cFile), 'utf8');
            out.write(cData);
            
            if (i < candleFiles.length - 1) {
                out.write(',\n');
            } else {
                out.write('\n');
            }
        }
    }
    
    out.write('  }\n}\n');
    out.end();
    
    out.on('finish', () => {
        const stats = fs.statSync(OUTPUT_FILE);
        console.log(`Compilation complete! Master archive created at docs/MASTER_BACKTEST_ARCHIVE.json`);
        console.log(`File size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
    });
}

function loadJsonSafe(p) {
    if (!fs.existsSync(p)) return null;
    try {
        return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (e) {
        return null;
    }
}

function loadTextSafe(p) {
    if (!fs.existsSync(p)) return null;
    try {
        return fs.readFileSync(p, 'utf8');
    } catch (e) {
        return null;
    }
}

compile().catch(console.error);
