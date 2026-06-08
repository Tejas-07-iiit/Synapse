import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function testVacuum() {
  try {
    console.log("Attempting VACUUM...");
    await prisma.$executeRawUnsafe('VACUUM synapse."StrategyExecution";');
    console.log("VACUUM successful.");
  } catch (err: any) {
    console.error("VACUUM failed:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

testVacuum();
