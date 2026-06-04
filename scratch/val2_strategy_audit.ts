
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const strategiesDir = path.join(__dirname, "../src/strategy-engine/strategies");

function auditStrategies() {
  const files = fs.readdirSync(strategiesDir);
  let md = "# STRATEGY MODE AUDIT\n\n";

  for (const folder of files) {
    const indexPath = path.join(strategiesDir, folder, "index.ts");
    if (fs.existsSync(indexPath)) {
      const content = fs.readFileSync(indexPath, "utf-8");
      
      const nameMatch = content.match(/name\s*=\s*"([^"]+)"/);
      const name = nameMatch ? nameMatch[1] : folder;

      const categoryMatch = content.match(/category:\s*TradingMode\s*=\s*TradingMode\.(SCALPING|INTRADAY|DEFENSIVE|SWING)/) || content.match(/category:\s*(?:ConsensusCategory|TradingMode)\.(SCALPING|INTRADAY|DEFENSIVE|SWING)/);
      const category = categoryMatch ? categoryMatch[1] : "UNKNOWN";

      const timeframesMatch = content.match(/supportedTimeframes\s*=\s*\[([^\]]+)\]/);
      let timeframes = "UNKNOWN";
      if (timeframesMatch) {
         timeframes = timeframesMatch[1].replace(/["'\s]/g, "").split(",").join("\n");
      }

      md += `${name}\n`;
      md += `Category:\n${category}\n\n`;
      md += `Timeframes:\n${timeframes}\n\n`;
      md += `---\n\n`;
    }
  }

  fs.writeFileSync(path.join(__dirname, "../docs/STRATEGY_MODE_AUDIT.md"), md);
  console.log("STRATEGY_MODE_AUDIT.md generated successfully.");
}

auditStrategies();
