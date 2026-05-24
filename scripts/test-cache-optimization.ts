import { MemoryCacheProvider } from "../src/infrastructure/cache-utils";

async function runCacheOptimizationTest() {
    console.log("=== STARTING CACHE OPTIMIZATION VERIFICATION TEST ===");

    const provider = new MemoryCacheProvider();

    // Test Case 1: Standard Cache Miss & Cache Hit
    console.log("\nTest Case 1: Standard Cache Miss & Cache Hit");
    const key1 = "test_key_1";
    
    // Attempt to get non-existent key
    const val1 = provider.get(key1);
    console.log(`- Initial get (expect null): ${val1}`);

    // Set value
    provider.set(key1, { foo: "bar" }, 5000); // 5s TTL
    console.log("- Set value to cache");

    // Get value
    const val2 = provider.get<{ foo: string }>(key1);
    console.log(`- Second get (expect { foo: 'bar' }): ${JSON.stringify(val2)}`);

    const metrics1 = provider.getMetrics();
    console.log(`- Metrics: hits=${metrics1.hitCount}, misses=${metrics1.missCount}, ratio=${metrics1.hitRatio}, size=${metrics1.cacheSize}`);

    const tc1Pass = val1 === null && val2?.foo === "bar" && metrics1.hitCount === 1 && metrics1.missCount === 1 && metrics1.cacheSize === 1;
    console.log(`- Test Case 1 Result: ${tc1Pass ? "PASS" : "FAIL"}`);

    // Test Case 2: Custom TTL Expiry
    console.log("\nTest Case 2: Custom TTL Expiry");
    const key2 = "test_key_2";
    provider.set(key2, "short-lived", 50); // 50ms TTL
    
    const val2Immediate = provider.get(key2);
    console.log(`- Immediate get (expect 'short-lived'): ${val2Immediate}`);

    await new Promise(resolve => setTimeout(resolve, 100)); // wait for expiry

    const val2Expired = provider.get(key2);
    console.log(`- Get after 100ms (expect null due to expiry): ${val2Expired}`);

    const tc2Pass = val2Immediate === "short-lived" && val2Expired === null;
    console.log(`- Test Case 2 Result: ${tc2Pass ? "PASS" : "FAIL"}`);

    // Test Case 3: Cache Stampede / Request Collapsing Protection
    console.log("\nTest Case 3: Cache Stampede / Request Collapsing Protection");
    const key3 = "test_key_3";
    let fetchCount = 0;

    const fetchFn = async () => {
        fetchCount++;
        await new Promise(resolve => setTimeout(resolve, 100)); // Mock slow fetch
        return { data: "fetched-data" };
    };

    // Dispatch 3 concurrent requests
    console.log("- Dispatching 3 concurrent getOrFetch calls...");
    const [res1, res2, res3] = await Promise.all([
        provider.getOrFetch(key3, fetchFn, 10000),
        provider.getOrFetch(key3, fetchFn, 10000),
        provider.getOrFetch(key3, fetchFn, 10000)
    ]);

    console.log(`- Fetch count (expect 1): ${fetchCount}`);
    console.log(`- Responses: res1=${res1.data}, res2=${res2.data}, res3=${res3.data}`);

    const tc3Pass = fetchCount === 1 && res1.data === "fetched-data" && res2.data === "fetched-data" && res3.data === "fetched-data";
    console.log(`- Test Case 3 Result: ${tc3Pass ? "PASS" : "FAIL"}`);

    // Test Case 4: Cache Invalidation (Delete)
    console.log("\nTest Case 4: Cache Invalidation (Delete)");
    const key4 = "test_key_4";
    provider.set(key4, "to-be-deleted", 10000);
    
    const val4Before = provider.get(key4);
    console.log(`- Get before delete (expect 'to-be-deleted'): ${val4Before}`);

    provider.delete(key4);
    console.log("- Deleted key");

    const val4After = provider.get(key4);
    console.log(`- Get after delete (expect null): ${val4After}`);

    const tc4Pass = val4Before === "to-be-deleted" && val4After === null;
    console.log(`- Test Case 4 Result: ${tc4Pass ? "PASS" : "FAIL"}`);

    // Global verification pass
    const allPassed = tc1Pass && tc2Pass && tc3Pass && tc4Pass;
    console.log(`\n=== CACHE OPTIMIZATION TEST: ${allPassed ? "PASS" : "FAIL"} ===`);
    process.exit(allPassed ? 0 : 1);
}

runCacheOptimizationTest().catch(err => {
    console.error("Test threw uncaught exception:", err);
    process.exit(1);
});
