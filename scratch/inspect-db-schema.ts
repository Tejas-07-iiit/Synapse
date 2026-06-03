import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== COMPREHENSIVE DB SCHEMA AUDIT ===");

  // 1. Current Search Path & Schema
  const searchPath = await prisma.$queryRaw`SHOW search_path`;
  console.log("Search Path:", JSON.stringify(searchPath, null, 2));

  const currentSchema = await prisma.$queryRaw`SELECT current_schema()`;
  console.log("Current Schema:", JSON.stringify(currentSchema, null, 2));

  // 2. Locate all tables named UserSettings across all schemas
  const tables = await prisma.$queryRaw`
    SELECT table_schema, table_name 
    FROM information_schema.tables 
    WHERE table_name ILIKE 'usersettings'
  `;
  console.log("Found UserSettings tables:", JSON.stringify(tables, null, 2));

  // 3. Inspect columns of UserSettings in 'synapse' schema
  const synapseColumns = await prisma.$queryRaw`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'UserSettings' AND table_schema = 'synapse'
    ORDER BY ordinal_position
  `;
  console.log("Columns of synapse.UserSettings:", JSON.stringify(synapseColumns, null, 2));

  // 4. Inspect columns of UserSettings in 'public' schema (if any)
  const publicColumns = await prisma.$queryRaw`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'UserSettings' AND table_schema = 'public'
    ORDER BY ordinal_position
  `;
  console.log("Columns of public.UserSettings:", JSON.stringify(publicColumns, null, 2));

  // 5. Inspect active constraints / indexes on UserSettings in synapse schema
  const constraints = await prisma.$queryRaw`
    SELECT
      tc.constraint_name, 
      tc.table_name, 
      kcu.column_name, 
      tc.constraint_type
    FROM 
      information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
    WHERE tc.table_name = 'UserSettings' AND tc.table_schema = 'synapse';
  `;
  console.log("Constraints on synapse.UserSettings:", JSON.stringify(constraints, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
