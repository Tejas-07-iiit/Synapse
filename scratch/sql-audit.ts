import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== RAW SQL DB AUDIT ===");
  try {
    // 1. Check search path
    const searchPath = await prisma.$queryRaw`SHOW search_path`;
    console.log("Search Path:", JSON.stringify(searchPath, null, 2));

    // 2. Check current schema
    const currentSchema = await prisma.$queryRaw`SELECT current_schema()`;
    console.log("Current Schema:", JSON.stringify(currentSchema, null, 2));

    // 3. List all columns in user_settings table physically
    const columns: any = await prisma.$queryRaw`
      SELECT table_schema, table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'UserSettings'
    `;
    
    console.log("Physical Columns in 'UserSettings':");
    if (columns.length === 0) {
      console.log("  -> TABLE NOT FOUND (Check case sensitivity or schema)");
      // Try lowercase
      const columnsLower: any = await prisma.$queryRaw`
        SELECT table_schema, table_name, column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'user_settings'
      `;
      console.log("Physical Columns in 'user_settings':", JSON.stringify(columnsLower, null, 2));
    } else {
      console.log(JSON.stringify(columns, null, 2));
    }

  } catch (err) {
    console.error("SQL AUDIT FAILED:", err);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
