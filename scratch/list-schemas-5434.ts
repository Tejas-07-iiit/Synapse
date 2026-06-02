import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://synapse:synapse_dev@localhost:5434/synapse_db"
    }
  }
});

async function main() {
  try {
    const schemas: any = await prisma.$queryRaw`
      SELECT schema_name FROM information_schema.schemata;
    `;
    console.log("SCHEMAS:", schemas);

    const tables: any = await prisma.$queryRaw`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema, table_name;
    `;
    console.log("TABLES:", tables);
  } catch (err) {
    console.error("Failed to query metadata:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
