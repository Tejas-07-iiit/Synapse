const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: {
      settings: true
    }
  });

  console.log("USERS AND SETTINGS:");
  for (const u of users) {
    console.log(`User: ${u.username} (${u.id})`);
    console.log(`Settings:`, u.settings);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
