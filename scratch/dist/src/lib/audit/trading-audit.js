let fs = null;
let path = null;
let LOG_DIR = '';
let TRADING_LOG = '';
let EXECUTION_LOG = '';
let ERRORS_LOG = '';
let HEARTBEAT_LOG = '';
if (typeof window === 'undefined') {
    // Use eval('require') to prevent Webpack from statically attempting to bundle Node built-ins.
    fs = eval('require')('fs');
    path = eval('require')('path');
    LOG_DIR = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(LOG_DIR)) {
        fs.mkdirSync(LOG_DIR, { recursive: true });
    }
    TRADING_LOG = path.join(LOG_DIR, 'trading.log');
    EXECUTION_LOG = path.join(LOG_DIR, 'execution.log');
    ERRORS_LOG = path.join(LOG_DIR, 'errors.log');
    HEARTBEAT_LOG = path.join(LOG_DIR, 'heartbeat.log');
}
/**
 * Writes a structured JSON log entry to the specified file and to stdout.
 */
function writeLog(file, eventType, data) {
    const payload = {
        timestamp: new Date().toISOString(),
        event: eventType,
        ...data,
    };
    try {
        if (fs && file) {
            fs.appendFileSync(file, JSON.stringify(payload) + '\n');
        }
        // Output minimal info to stdout for PM2 logs without spamming full JSON
        const summary = data.reason || data.symbol || data.message || "";
        console.log(`[${eventType}] ${summary}`.trim());
    }
    catch (err) {
        console.error("[AuditLogger] Failed to write log:", err);
    }
}
export class AuditLogger {
    // --------------------------------------------------------------------------
    // SIGNAL LOGGING (TRADING_LOG)
    // --------------------------------------------------------------------------
    static logSignalGenerated(data) {
        writeLog(TRADING_LOG, "SIGNAL_GENERATED", data);
    }
    static logSignalRejected(data) {
        writeLog(TRADING_LOG, "SIGNAL_REJECTED", data);
    }
    static logConfidenceRejected(data) {
        writeLog(TRADING_LOG, "SIGNAL_REJECTED", { ...data, reason: `Confidence ${data.confidence}% below threshold ${data.threshold}%` });
    }
    // --------------------------------------------------------------------------
    // EXECUTION LOGGING (EXECUTION_LOG)
    // --------------------------------------------------------------------------
    static logTradeExecuted(data) {
        writeLog(EXECUTION_LOG, "TRADE_EXECUTED", data);
    }
    static logTradeClosed(data) {
        writeLog(EXECUTION_LOG, "TRADE_CLOSED", data);
    }
    static logTakeProfitHit(data) {
        writeLog(EXECUTION_LOG, "TAKE_PROFIT_HIT", data);
    }
    static logStopLossHit(data) {
        writeLog(EXECUTION_LOG, "STOP_LOSS_HIT", data);
    }
    static logCooldownBlocked(data) {
        writeLog(EXECUTION_LOG, "SIGNAL_REJECTED", { ...data, reason: `Cooldown active (${data.remainingMinutes}m remaining, last: ${data.lastStatus})` });
    }
    static logQuarantineBlocked(data) {
        writeLog(EXECUTION_LOG, "SIGNAL_REJECTED", { ...data, reason: `Strategy quarantined` });
    }
    static logRiskRejected(data) {
        writeLog(EXECUTION_LOG, "SIGNAL_REJECTED", data);
    }
    static logPositionMonitor(data) {
        writeLog(EXECUTION_LOG, "POSITION_MONITOR", data);
    }
    // --------------------------------------------------------------------------
    // HEARTBEAT (HEARTBEAT_LOG)
    // --------------------------------------------------------------------------
    static logDaemonHeartbeat(data) {
        writeLog(HEARTBEAT_LOG, "HEARTBEAT", data);
    }
    // --------------------------------------------------------------------------
    // ERRORS (ERRORS_LOG)
    // --------------------------------------------------------------------------
    static logDatabaseError(data) {
        writeLog(ERRORS_LOG, "DATABASE_ERROR", data);
    }
    static logSystemError(data) {
        writeLog(ERRORS_LOG, "SYSTEM_ERROR", data);
    }
}
