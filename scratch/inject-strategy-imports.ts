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

    // If it has TradingMode in the file but does not import it, add the import
    const hasTradingModeUsed = content.includes("TradingMode");
    const hasTradingModeImported = content.includes("import") && content.includes("TradingMode") && (content.includes("types") || content.includes("@prisma/client"));
    
    // In our case, we want to make sure it imports TradingMode from "../../types"
    // Let's check if the import line is present
    const importLineRegex = /import\s+{[^}]*TradingMode[^}]*}\s+from\s+["']\.\.\/\.\.\/types["'];/;
    
    if (hasTradingModeUsed && !importLineRegex.test(content)) {
      // Let's modify the first import to include TradingMode, or just add it
      // Let's see: if it already imports from "../../types", let's update it to include TradingMode
      const typesImportRegex = /import\s+({[^}]+})\s+from\s+["']\.\.\/\.\.\/types["'];/;
      const typesImportMatch = content.match(typesImportRegex);
      
      if (typesImportMatch) {
        // e.g., import { TradingStrategy, StrategyContext, StrategySignal } from "../../types";
        const innerImports = typesImportMatch[1]; // { TradingStrategy, StrategyContext, StrategySignal }
        if (!innerImports.includes("TradingMode")) {
          // Insert TradingMode
          const updatedInner = innerImports.replace("{", "{ TradingMode, ");
          content = content.replace(typesImportMatch[0], `import ${updatedInner} from "../../types";`);
          console.log(`Updated existing types import in ${dirName}/index.ts`);
        }
      } else {
        // Add new import line at top
        content = `import { TradingMode } from "../../types";\n` + content;
        console.log(`Added new types import at top of ${dirName}/index.ts`);
      }
      
      fs.writeFileSync(indexPath, content, "utf8");
      updatedCount++;
    }
  }

  console.log(`Done. Updated imports in ${updatedCount} strategies.`);
}

run();
