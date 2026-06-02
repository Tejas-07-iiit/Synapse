import * as fs from "fs";
import * as path from "path";

const strategiesDir = path.join(__dirname, "../src/strategy-engine/strategies");

function run() {
  const dirs = fs.readdirSync(strategiesDir);
  let updatedCount = 0;

  for (const dirName of dirs) {
    const fullPath = path.join(strategiesDir, dirName);
    if (!fs.statSync(fullPath).isDirectory()) continue;

    const indexPath = path.join(fullPath, "index.ts");
    if (!fs.existsSync(indexPath)) continue;

    let content = fs.readFileSync(indexPath, "utf8");

    // Replace the import
    if (content.includes('import { TradingMode } from "@prisma/client";')) {
      content = content.replace(
        'import { TradingMode } from "@prisma/client";',
        'import { TradingMode } from "../../types";'
      );
      fs.writeFileSync(indexPath, content, "utf8");
      console.log(`Updated import in ${dirName}/index.ts`);
      updatedCount++;
    }
  }

  console.log(`Done. Updated imports in ${updatedCount} strategies.`);
}

run();
