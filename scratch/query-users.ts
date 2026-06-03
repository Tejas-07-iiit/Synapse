import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== USERS IN DB ===");
  try {
    const users = await prisma.user.findMany();
    console.log("Users count:", users.length);
    console.log("Users:", JSON.stringify(users, null, 2));

    const settings = await prisma.userSettings.findMany();
    console.log("UserSettings count:", settings.length);
    console.log("UserSettings:", JSON.stringify(settings, null, 2));

    console.log("--- Executing daemon raw query ---");
    const res1 = await prisma.$queryRawUnsafe(`
      SELECT s.*, 
             (SELECT row_to_json(u) FROM "synapse"."User" u WHERE u."id" = s."userId") as user
      FROM "synapse"."UserSettings" s
      WHERE s."autoTrading" = true
    `);
    console.log("Result of primary raw query:", JSON.stringify(res1, null, 2));
  } catch (err: any) {
    console.error("Primary raw query failed:", err.message || err);
  }

  try {
    console.log("--- Executing fallback raw query ---");
    const res2 = await prisma.$queryRawUnsafe(`
      SELECT s.*, 
             (SELECT row_to_json(u) FROM "User" u WHERE u."id" = s."userId") as user
      FROM "UserSettings" s
      WHERE s."autoTrading" = true
    `);
    console.log("Result of fallback raw query:", JSON.stringify(res2, null, 2));
  } catch (err: any) {
    console.error("Fallback raw query failed:", err.message || err);
  }

  try {
    console.log("--- Executing standard Prisma query ---");
    const res3 = await prisma.userSettings.findMany({
      where: { autoTrading: true },
      include: { user: true }
    });
    console.log("Result of standard Prisma query:", JSON.stringify(res3, null, 2));
  } catch (err: any) {
    console.error("Standard Prisma query failed:", err.message || err);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
