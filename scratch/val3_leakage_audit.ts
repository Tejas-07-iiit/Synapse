
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

async function main() {
  const trades = await prisma.trade.findMany({
    take: 100,
    orderBy: { openedAt: "desc" },
    include: {
      user: {
        include: { settings: true }
      }
    }
  });

  let md = "# MODE LEAKAGE AUDIT\n\n";
  md += "| Trade ID | User Mode | Strategy | Strategy Category | Signal Timeframe | Actual Used | Allowed Category? | Allowed Timeframe? |\n";
  md += "| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n";

  for (const trade of trades) {
    const userMode = trade.user?.settings?.preferredTradingMode || "UNKNOWN";
    const strategy = trade.strategyName;
    const strategyCategory = trade.strategyCategory || "UNKNOWN";
    
    // Try to find timeframe from auditPayload
    let signalTimeframe = "UNKNOWN";
    const audit = trade.auditPayload as any;
    if (audit && audit.marketSnapshot && audit.marketSnapshot.timeframe) {
      signalTimeframe = audit.marketSnapshot.timeframe;
    } else if (audit && audit.timeframe) {
      signalTimeframe = audit.timeframe;
    }

    // Heuristics for allowed Category
    let allowedCategory = "UNKNOWN";
    if (userMode === "SCALPING") {
      allowedCategory = ["SCALPING", "DEFENSIVE"].includes(strategyCategory.toUpperCase()) ? "YES (LEAKED DEFENSIVE)" : "NO";
      if (strategyCategory.toUpperCase() === "SCALPING") allowedCategory = "YES";
    } else if (userMode === "INTRADAY") {
      allowedCategory = ["SCALPING", "INTRADAY", "DEFENSIVE"].includes(strategyCategory.toUpperCase()) ? "YES (LEAKED SCALPING)" : "NO";
      if (["INTRADAY", "DEFENSIVE"].includes(strategyCategory.toUpperCase())) allowedCategory = "YES";
    }

    // Heuristics for allowed Timeframe
    let allowedTimeframe = "UNKNOWN";
    if (userMode === "SCALPING") {
      allowedTimeframe = ["1m", "3m", "5m"].includes(signalTimeframe) ? "YES" : "NO";
    } else if (userMode === "INTRADAY") {
      allowedTimeframe = ["15m", "30m", "1h"].includes(signalTimeframe) ? "YES (LEAKED 1H)" : "NO";
      if (["15m", "30m"].includes(signalTimeframe)) allowedTimeframe = "YES";
    }

    md += `| ${trade.id.substring(0,8)} | ${userMode} | ${strategy} | ${strategyCategory} | ${signalTimeframe} | ${signalTimeframe} | ${allowedCategory} | ${allowedTimeframe} |\n`;
  }

  fs.writeFileSync(path.join(__dirname, "../docs/MODE_LEAKAGE_AUDIT.md"), md);
  console.log("MODE_LEAKAGE_AUDIT.md generated successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
