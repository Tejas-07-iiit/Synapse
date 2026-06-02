import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Checking UserSettings for riskPerTradePct column...");
  try {
    const settings = await prisma.userSettings.findFirst();
    if (settings) {
      console.log("Found settings:", JSON.stringify(settings, null, 2));
      if ('riskPerTradePct' in settings) {
        console.log("SUCCESS: riskPerTradePct column exists in the runtime object.");
      } else {
        console.log("FAILURE: riskPerTradePct column DOES NOT exist in the runtime object.");
      }
    } else {
      console.log("No settings found to check.");
    }
  } catch (err) {
    console.error("CRITICAL ERROR: Failed to query UserSettings. This usually confirms the column is missing in the physical DB.", err);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
