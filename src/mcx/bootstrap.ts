import { CandleBuilder } from "./candles/CandleBuilder";
import { ExecutionService } from "./execution/ExecutionService";
import { MarketDataService } from "./market-data/MarketDataService";
import { StrategyEngine } from "./strategies/StrategyEngine";
import { WalletService } from "./wallet/WalletService";
import { mcxLogger } from "./utils/logger";
import { AngelOneProvider } from "./market-data/AngelOneProvider";
import { PriceIntegrityGuard } from "./analytics/PriceIntegrityGuard";
import { mcxConfig } from "./config/mcx.config";

let isBootstrapped = false;

export async function bootstrapMCX() {
  if (isBootstrapped) return;
  isBootstrapped = true;
  mcxLogger.info("Bootstrapping MCX V2 Postgres engine");
  
  MarketDataService.initialize();
  AngelOneProvider.initialize();
  CandleBuilder.initialize();
  StrategyEngine.initialize();
  ExecutionService.initialize();
  WalletService.initialize();
  PriceIntegrityGuard.start();

  // STEP 9: Validation Report
  void validateArchitecture();
  
  mcxLogger.info("MCX V2 Bootstrap Complete");
}

async function validateArchitecture() {
  mcxLogger.info("--- MCX ARCHITECTURE VALIDATION REPORT ---");
  for (const symbol of mcxConfig.marketData.symbols) {
    try {
      const contract = await MarketDataService.resolveContract(symbol);
      const price = await MarketDataService.latestPrice(symbol);
      mcxLogger.info(`VALIDATION [${symbol}]:`, {
        contract: contract.contractName,
        token: contract.token,
        expiry: contract.expiry.toISOString(),
        sourceOfTruthPrice: price,
      });
    } catch (err: any) {
      mcxLogger.warn(`VALIDATION [${symbol}] FAILED:`, { error: err.message });
    }
  }
  mcxLogger.info("------------------------------------------");
}
