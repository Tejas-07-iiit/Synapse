import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== DIRECT SQL VERIFICATION ===");
  try {
    const tables: any = await prisma.$queryRaw`
      SELECT table_schema, table_name
      FROM information_schema.tables
      ORDER BY table_schema, table_name
    `;
    console.log("All tables in DB:", JSON.stringify(tables, null, 2));
  } catch (err) {
    console.error("Failed to fetch tables:", err);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
