// This script demonstrates how to fetch candle data from Binance
// and calculate a simple indicator (Simple Moving Average - SMA).

// 1. Define the parameters for Binance
const symbol = "BTCUSDT";
const interval = "1h"; // 1 hour candles
const limit = 10; // Get the last 10 candles

// The Binance API endpoint for Candles (Klines)
const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;

console.log(`\n======================================================`);
console.log(`Fetching last ${limit} candles for ${symbol} from Binance...`);
console.log(`Endpoint: ${url}`);
console.log(`======================================================\n`);

// 2. Fetch the data from Binance
fetch(url)
  .then(response => response.json())
  .then(data => {
    // 3. Binance returns an array of arrays for each candle. 
    // The "Close" price is always at index 4.
    // [0] Open Time, [1] Open, [2] High, [3] Low, [4] CLOSE, [5] Volume...
    
    console.log("Extracting Close Prices from raw Binance K-line data:");
    console.log(data)
    
    const closingPrices = data.map((candle, index) => {
      const price = parseFloat(candle[4]);
      console.log(`  Candle ${index + 1}: $${price.toFixed(2)}`);
      return price;
    });

    console.log("\nCalculating Indicator...");

    // 4. Calculate a Simple Moving Average (SMA) indicator
    // We will calculate a 5-period SMA using the last 5 candles
    const period = 5;
    
    if (closingPrices.length >= period) {
        // Take the last 5 closing prices from the array
        const last5Prices = closingPrices.slice(-period);
        
        // Add them all together
        const sum = last5Prices.reduce((total, price) => total + price, 0);
        
        // Divide by the period (5) to get the average
        const sma = sum / period;
        
        const currentPrice = closingPrices[closingPrices.length - 1];

        console.log(`\n======================================================`);
        console.log(`📊 INDICATOR RESULT`);
        console.log(`======================================================`);
        console.log(`Current Price: $${currentPrice.toFixed(2)}`);
        console.log(`5-Period SMA:  $${sma.toFixed(2)}`);
        console.log(`------------------------------------------------------`);
        
        // 5. A very simple trading logic / signal based on the indicator
        if (currentPrice > sma) {
            console.log(`🟢 SIGNAL: BULLISH (Price is above the SMA)`);
        } else if (currentPrice < sma) {
            console.log(`🔴 SIGNAL: BEARISH (Price is below the SMA)`);
        } else {
            console.log(`⚪ SIGNAL: NEUTRAL (Price equals the SMA)`);
        }
        console.log(`======================================================\n`);
    }
  })
  .catch(error => {
    console.error("Error fetching data from Binance:");
    console.error(error);
  });
