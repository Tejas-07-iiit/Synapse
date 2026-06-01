let fs: any = null;
let path: any = null;
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
function writeLog(file: string, eventType: string, data: Record<string, any>) {
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
  } catch (err) {
    console.error("[AuditLogger] Failed to write log:", err);
  }
}

export class AuditLogger {
  // --------------------------------------------------------------------------
  // SIGNAL LOGGING (TRADING_LOG)
  // --------------------------------------------------------------------------
  
  public static logSignalGenerated(data: { strategyId?: string; strategyName: string; symbol: string; timeframe: string; confidence: number; direction: string; regime?: string }) {
    writeLog(TRADING_LOG, "SIGNAL_GENERATED", data);
  }

  public static logSignalRejected(data: { strategyId?: string; strategyName?: string; symbol: string; timeframe?: string; confidence?: number; reason: string }) {
    writeLog(TRADING_LOG, "SIGNAL_REJECTED", data);
  }

  public static logConfidenceRejected(data: { strategyId?: string; strategyName?: string; symbol: string; confidence: number; threshold: number }) {
    writeLog(TRADING_LOG, "SIGNAL_REJECTED", { ...data, reason: `Confidence ${data.confidence}% below threshold ${data.threshold}%` });
  }

  // --------------------------------------------------------------------------
  // EXECUTION LOGGING (EXECUTION_LOG)
  // --------------------------------------------------------------------------

  public static logTradeExecuted(data: { userId: string; symbol: string; direction: string; entry: number; sl: number | null; tp: number | null; quantity: number; strategyName?: string; confidence?: number }) {
    writeLog(EXECUTION_LOG, "TRADE_EXECUTED", data);
  }

  public static logTradeClosed(data: { userId: string; symbol: string; entry: number; exit: number; pnl: number; reason: string; strategyName?: string }) {
    writeLog(EXECUTION_LOG, "TRADE_CLOSED", data);
  }

  public static logTakeProfitHit(data: { userId: string; symbol: string; entry: number; exit: number; profit: number; roi: number; strategyName?: string }) {
    writeLog(EXECUTION_LOG, "TAKE_PROFIT_HIT", data);
  }

  public static logStopLossHit(data: { userId: string; symbol: string; entry: number; exit: number; loss: number; roi: number; strategyName?: string }) {
    writeLog(EXECUTION_LOG, "STOP_LOSS_HIT", data);
  }

  public static logCooldownBlocked(data: { userId: string; symbol: string; remainingMinutes: number; lastStatus: string }) {
    writeLog(EXECUTION_LOG, "SIGNAL_REJECTED", { ...data, reason: `Cooldown active (${data.remainingMinutes}m remaining, last: ${data.lastStatus})` });
  }

  public static logQuarantineBlocked(data: { userId: string; symbol: string; strategyId: string }) {
    writeLog(EXECUTION_LOG, "SIGNAL_REJECTED", { ...data, reason: `Strategy quarantined` });
  }

  public static logRiskRejected(data: { userId: string; symbol: string; reason: string }) {
    writeLog(EXECUTION_LOG, "SIGNAL_REJECTED", data);
  }

  public static logPositionMonitor(data: { symbol: string; positionId: string; currentPrice: number; entry: number; sl: number | null; tp: number | null; distanceToTpPct: number | null; distanceToSlPct: number | null }) {
    writeLog(EXECUTION_LOG, "POSITION_MONITOR", data);
  }

  // --------------------------------------------------------------------------
  // HEARTBEAT (HEARTBEAT_LOG)
  // --------------------------------------------------------------------------

  public static logDaemonHeartbeat(data: { status: string; wsConnected: boolean; activeUsers: number; openPositions: number; trackedSymbols: string[] }) {
    writeLog(HEARTBEAT_LOG, "HEARTBEAT", data);
  }

  // --------------------------------------------------------------------------
  // ERRORS (ERRORS_LOG)
  // --------------------------------------------------------------------------

  public static logDatabaseError(data: { action: string; message: string; errorDetails: any }) {
    writeLog(ERRORS_LOG, "DATABASE_ERROR", data);
  }

  public static logSystemError(data: { module: string; message: string; errorDetails?: any }) {
    writeLog(ERRORS_LOG, "SYSTEM_ERROR", data);
  }
}
