const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'app/trade-history/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Ensure strategyCompetition mapping is safe
content = content.replace(
  /\{strategyCompetition\.map\(\(strat: any, i: number\) => \(/g,
  '{strategyCompetition.filter(Boolean).map((strat: any, i: number) => ('
);

// Ensure otherStrategiesLost mapping is safe
content = content.replace(
  /\{otherStrategiesLost\.map\(\(lost: any, i: number\) => \(/g,
  '{otherStrategiesLost.filter(Boolean).map((lost: any, i: number) => ('
);

fs.writeFileSync(filePath, content, 'utf8');
console.log("Patched safely.");
