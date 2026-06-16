import prisma from "../lib/prisma";

async function run() {
  console.log("Checking DB status for MCX...");
  const users = await prisma.user.findMany();
  console.log(`Total users in DB: ${users.length}`);
  for (const u of users) {
    console.log(`User: id=${u.id}, username=${u.username}, email=${u.email}`);
  }

  const instruments = await prisma.mcxInstrument.findMany();
  console.log(`Total MCX instruments in DB: ${instruments.length}`);
  for (const inst of instruments.slice(0, 10)) {
    console.log(`- ${inst.symbol} (${inst.contractName}): token=${inst.token}, active=${inst.active}, expiry=${inst.expiry.toISOString()}`);
  }

  const wallets = await prisma.mcxWallet.findMany();
  console.log(`Total MCX wallets in DB: ${wallets.length}`);
  for (const w of wallets) {
    console.log(`- Wallet for ${w.userId}: equity=${w.equity}, availableBalance=${w.availableBalance}, blockedMargin=${w.blockedMargin}, realizedPnL=${w.realizedPnL}, tradingHalted=${w.tradingHalted}, haltReason=${w.haltReason}`);
  }

  const candles = await prisma.mcxCandle.findMany({
    take: 5,
    orderBy: { timestamp: "desc" }
  });
  console.log(`Sample MCX Candles count (desc): ${candles.length}`);
  for (const c of candles) {
    console.log(`- ${c.symbol} ${c.interval} ${c.timestamp.toISOString()}: open=${c.open}, close=${c.close}, isClosed=${c.isClosed}, token=${c.token}`);
  }
}

run()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
