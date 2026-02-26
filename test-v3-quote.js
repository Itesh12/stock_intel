const YahooFinance = require('yahoo-finance2').default;
console.log('Class status:', !!YahooFinance);
const yahooFinance = new YahooFinance();

async function test() {
  console.log('Starting fetch for RELIANCE.NS...');
  try {
    const result = await yahooFinance.quote('RELIANCE.NS');
    console.log('Result found:', !!result);
    if (result) {
      console.log('Keys:', Object.keys(result));
      console.log('Price:', result.regularMarketPrice);
      console.log('Short Name:', result.shortName);
    }
  } catch (err) {
    console.error('Fetch error:', err.message);
  }
}
test();
