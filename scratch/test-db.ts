import prisma from "../lib/prisma";

async function test() {
  try {
    console.log("Prisma keys:", Object.keys(prisma));
    const count = await prisma.position.count();
    console.log("Successfully connected! Active position count:", count);
  } catch (err) {
    console.error("Test failed:", err);
  }
}

test();
