import prisma from "../lib/prisma";

async function run() {
  const users = await prisma.user.findMany({
    select: { id: true, username: true, email: true },
  });
  console.log("Users:", users);
}

run();
