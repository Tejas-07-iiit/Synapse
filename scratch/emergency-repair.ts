import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== EMERGENCY DATABASE REPAIR ===");
  try {
    console.log("Checking if column riskPerTradePct exists physically...");
    const checkColumn: any = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'UserSettings' AND column_name = 'riskPerTradePct'
    `;

    if (checkColumn.length === 0) {
      console.log("Column missing! Manually adding it via ALTER TABLE...");
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "synapse"."UserSettings" 
        ADD COLUMN IF NOT EXISTS "riskPerTradePct" DOUBLE PRECISION DEFAULT 2.0
      `);
      console.log("Column added successfully.");
    } else {
      console.log("Column already exists physically.");
    }

    console.log("Verification successful.");
  } catch (err) {
    console.error("REPAIR FAILED:", err);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
