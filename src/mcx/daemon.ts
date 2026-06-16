import { bootstrapMCX } from "./bootstrap";
import { mcxLogger } from "./utils/logger";
import { CandleBuilder } from "./candles/CandleBuilder";

async function runDaemon() {
  mcxLogger.info("Starting MCX Dedicated Trading Daemon...");
  try {
    await bootstrapMCX({ mode: "daemon" });
    mcxLogger.info("MCX Daemon is now running and keeping data fresh.");
  } catch (error: any) {
    mcxLogger.error("CRITICAL: MCX Daemon failed to start", { error: error.message });
    process.exit(1);
  }
}

async function shutdown() {
  mcxLogger.info("MCX Daemon shutting down...");
  try {
    await CandleBuilder.shutdown();
  } catch (err: any) {
    mcxLogger.error("Error during shutdown", { error: err.message });
  } finally {
    process.exit(0);
  }
}

// Handle termination
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

void runDaemon();
