const axios = require("axios");

async function run() {
  try {
    const res = await axios.get("https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json");
    const mcxFutures = res.data.filter(
      i => i.exch_seg === "MCX" && i.instrumenttype === "FUTCOM"
    );
    console.log("Total MCX Futures:", mcxFutures.length);
    const samples = mcxFutures.filter(i => i.symbol.startsWith("GOLD") || i.symbol.startsWith("SILVER") || i.symbol.startsWith("CRUDE"));
    console.log("Sample scrips:");
    samples.slice(0, 10).forEach(s => {
      console.log({
        symbol: s.symbol,
        token: s.token,
        strike: s.strike,
        lastprice: s.lastprice,
        lotSize: s.lotsize
      });
    });
  } catch (e) {
    console.error(e);
  }
}

run();
