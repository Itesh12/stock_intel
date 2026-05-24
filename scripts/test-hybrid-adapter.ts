import { HybridMarketAdapter } from "../src/adapters/hybrid/market-adapter";
import { MarketDataPort } from "../src/ports/market-data-port";
import { Stock } from "../src/domain/stock";
import { CacheUtils } from "../src/infrastructure/cache-utils";

// Mock CacheUtils to provide local in-memory fallback mappings
const mockCache: Record<string, any> = {};
(CacheUtils as any).getFallback = (key: string) => {
    return mockCache[key] || null;
};
(CacheUtils as any).set = (key: string, val: any) => {
    mockCache[key] = val;
};

async function runHybridAdapterTest() {
    console.log("=== STARTING HYBRID ADAPTER VERIFICATION TEST ===");

    const mockStock: Partial<Stock> = {
        symbol: "TCS.NS",
        price: 3500,
        change: 10,
        changePercent: 0.3
    };

    // Cache fallback state
    mockCache["price_TCS.NS"] = { ...mockStock, price: 3400, name: "Cached TCS" };

    // 1. Setup Mock Providers
    let yahooCallCount = 0;
    let yahooDelayMs = 0;
    let yahooShouldFail = false;

    const mockYahoo: MarketDataPort = {
        async getStockPrice(symbol: string): Promise<Partial<Stock>> {
            yahooCallCount++;
            if (yahooDelayMs > 0) {
                await new Promise(resolve => setTimeout(resolve, yahooDelayMs));
            }
            if (yahooShouldFail) {
                throw new Error("Yahoo network failure");
            }
            return { symbol, price: 3500 };
        },
        getHistoricalData: async () => [],
        getPerformance: async () => ({}) as any,
        searchStocks: async () => [],
        getScreenerData: async () => [],
        getNews: async () => []
    };

    let finnhubCallCount = 0;
    let finnhubShouldFail = false;

    const mockFinnhub: MarketDataPort = {
        async getStockPrice(symbol: string): Promise<Partial<Stock>> {
            finnhubCallCount++;
            if (finnhubShouldFail) {
                throw new Error("Finnhub network failure");
            }
            return { symbol, price: 3550 };
        },
        getHistoricalData: async () => [],
        getPerformance: async () => ({}) as any,
        searchStocks: async () => [],
        getScreenerData: async () => [],
        getNews: async () => []
    };

    const hybrid = new HybridMarketAdapter(mockYahoo, mockFinnhub);

    // Test Case 1: Healthy execution (Yahoo succeeds)
    console.log("\nTest Case 1: Healthy execution (Yahoo succeeds)");
    const price1 = await hybrid.getStockPrice("TCS.NS");
    console.log(`- regular price: ${price1.price}`);
    console.log(`- Yahoo calls: ${yahooCallCount}, Finnhub calls: ${finnhubCallCount}`);
    const report1 = hybrid.getHealthReport();
    console.log(`- Yahoo healthy: ${report1.yahoo.isHealthy}, requests: ${report1.yahoo.requestCount}, failures: ${report1.yahoo.failureCount}`);

    // Test Case 2: Timeout verification (Yahoo is too slow, falls back to Finnhub)
    console.log("\nTest Case 2: Timeout verification (Yahoo takes 6s, exceeds 5s timeout)");
    yahooDelayMs = 6000;
    const price2 = await hybrid.getStockPrice("TCS.NS");
    console.log(`- regular price (fell back to Finnhub): ${price2.price}`);
    console.log(`- Yahoo calls: ${yahooCallCount}, Finnhub calls: ${finnhubCallCount}`);
    const report2 = hybrid.getHealthReport();
    console.log(`- Yahoo healthy: ${report2.yahoo.isHealthy}, failures: ${report2.yahoo.failureCount}`);
    
    // Test Case 3: Circuit Breaker Verification (Trip after 5 consecutive failures)
    console.log("\nTest Case 3: Circuit Breaker Verification");
    yahooDelayMs = 0;
    yahooShouldFail = true;
    finnhubShouldFail = true;

    console.log("Triggering 5 consecutive failures to trip circuit breaker...");
    for (let i = 0; i < 5; i++) {
        try {
            await hybrid.getStockPrice("TCS.NS");
        } catch (err: any) {
            // Ignored, will fall back to cache
        }
    }

    const reportBeforeTrip = hybrid.getHealthReport();
    console.log(`- Yahoo consecutive failures: ${reportBeforeTrip.yahoo.consecutiveFailures}, healthy: ${reportBeforeTrip.yahoo.isHealthy}`);

    const yahooCallsBeforeBypass = yahooCallCount;

    // The 6th request should trip the circuit breaker and bypass Yahoo completely
    console.log("Triggering 6th request...");
    const priceCache = await hybrid.getStockPrice("TCS.NS");
    console.log(`- Price fetched (from cache fallback): ${priceCache.price} (${priceCache.name})`);
    
    const reportAfterTrip = hybrid.getHealthReport();
    console.log(`- Yahoo consecutive failures after 6th: ${reportAfterTrip.yahoo.consecutiveFailures}`);
    console.log(`- Yahoo isHealthy: ${reportAfterTrip.yahoo.isHealthy}`);
    console.log(`- Yahoo unhealthyUntil active: ${reportAfterTrip.yahoo.unhealthyUntil ? "YES (" + reportAfterTrip.yahoo.unhealthyUntil + ")" : "NO"}`);
    console.log(`- Yahoo calls total: ${yahooCallCount} (should not have incremented if bypassed. Before: ${yahooCallsBeforeBypass}, After: ${yahooCallCount})`);

    // Verify verification PASS/FAIL
    const pass = 
        price1.price === 3500 &&
        price2.price === 3550 &&
        priceCache.name === "Cached TCS" &&
        reportAfterTrip.yahoo.isHealthy === false &&
        reportAfterTrip.yahoo.unhealthyUntil !== undefined &&
        yahooCallCount === yahooCallsBeforeBypass;

    console.log(`\n=== HYBRID ADAPTER TEST: ${pass ? "PASS" : "FAIL"} ===`);
    process.exit(pass ? 0 : 1);
}

runHybridAdapterTest().catch(err => {
    console.error("Test threw uncaught exception:", err);
    process.exit(1);
});
