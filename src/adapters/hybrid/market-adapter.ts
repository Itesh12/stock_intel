import { MarketDataPort } from "../../ports/market-data-port";
import { Stock } from "../../domain/stock";
import { CacheUtils } from "../../infrastructure/cache-utils";

export interface ProviderMetrics {
    requestCount: number;
    failureCount: number;
    consecutiveFailures: number;
    totalLatencyMs: number;
    averageLatencyMs: number;
    lastSuccessfulRequest?: Date;
    isHealthy: boolean;
    lastFailureTime?: Date;
    unhealthyUntil?: Date;
}

export class HybridMarketAdapter implements MarketDataPort {
    private providers: Record<string, MarketDataPort | null>;
    private timeouts: Record<string, number> = {
        yahoo: 12000, // 12s timeout for concurrent requests
        finnhub: 5000
    };

    private metrics: Record<string, ProviderMetrics> = {
        yahoo: { requestCount: 0, failureCount: 0, consecutiveFailures: 0, totalLatencyMs: 0, averageLatencyMs: 0, isHealthy: true },
        finnhub: { requestCount: 0, failureCount: 0, consecutiveFailures: 0, totalLatencyMs: 0, averageLatencyMs: 0, isHealthy: true }
    };

    constructor(yahoo: MarketDataPort, finnhub: MarketDataPort | null) {
        this.providers = {
            yahoo,
            finnhub
        };
    }

    private async executeWithTimeout<T>(promise: Promise<T>, timeoutMs: number, providerName: string): Promise<T> {
        let timeoutHandle: NodeJS.Timeout;
        const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutHandle = setTimeout(() => {
                reject(new Error(`TimeoutError: Request to provider '${providerName}' timed out after ${timeoutMs}ms`));
            }, timeoutMs);
        });
        return Promise.race([promise, timeoutPromise]).finally(() => {
            clearTimeout(timeoutHandle);
        });
    }

    private async executeWithFallback<T>(
        methodName: string,
        providerOrder: string[],
        executeFn: (providerName: string, provider: MarketDataPort) => Promise<T>,
        fallbackCacheKey?: string
    ): Promise<T> {
        let lastError: any = null;

        for (const providerName of providerOrder) {
            const provider = this.providers[providerName];
            if (!provider) continue;

            const metrics = this.metrics[providerName];

            // Circuit Breaker check (10s short cooldown)
            if (metrics.unhealthyUntil && metrics.unhealthyUntil > new Date()) {
                console.log(`[HybridMarketAdapter] Skipping unhealthy provider '${providerName}' (cooling down)`);
                continue;
            }

            const startTime = Date.now();
            metrics.requestCount++;

            try {
                const timeoutMs = this.timeouts[providerName] || 12000;
                const result = await this.executeWithTimeout(
                    executeFn(providerName, provider),
                    timeoutMs,
                    providerName
                );

                // Update success metrics
                const latency = Date.now() - startTime;
                metrics.totalLatencyMs += latency;
                metrics.averageLatencyMs = metrics.totalLatencyMs / metrics.requestCount;
                metrics.lastSuccessfulRequest = new Date();
                metrics.consecutiveFailures = 0;
                metrics.isHealthy = true;
                metrics.unhealthyUntil = undefined;

                return result;
            } catch (err: any) {
                // Update failure metrics
                metrics.failureCount++;
                metrics.consecutiveFailures++;
                metrics.lastFailureTime = new Date();

                console.warn(`[HybridMarketAdapter] Provider '${providerName}' failed for '${methodName}': ${err.message || err}`);
                lastError = err;

                // Trip Circuit Breaker after 15 failures, cool down for 10 seconds
                if (metrics.consecutiveFailures > 15) {
                    metrics.isHealthy = false;
                    metrics.unhealthyUntil = new Date(Date.now() + 10000); // 10s cooldown
                    console.error(`[HybridMarketAdapter] Circuit broken for provider '${providerName}'. Cooling down for 10s.`);
                }
            }
        }

        // Cache Fallback
        if (fallbackCacheKey) {
            const cached = CacheUtils.getFallback(fallbackCacheKey);
            if (cached) {
                console.info(`[HybridMarketAdapter] Fallback to cache for '${methodName}' (key: ${fallbackCacheKey})`);
                return cached as T;
            }
        }

        console.warn(`[HybridMarketAdapter] All providers failed for '${methodName}'. Returning safe fallback.`);
        
        // Return safe fallbacks to prevent breaking Promise.all batch requests
        if (methodName === "getPerformance" || methodName === "getStockPrice") {
            return {
                symbol: "",
                currentPrice: 0,
                change: 0,
                changePercent: 0,
                volume: 0
            } as unknown as T;
        }
        if (methodName === "getHistoricalData" || methodName === "searchStocks" || methodName === "getScreenerData" || methodName === "getNews") {
            return [] as unknown as T;
        }

        throw new Error(`[HybridMarketAdapter] All providers failed for '${methodName}'. Last error: ${lastError?.message || lastError}`);
    }

    async getStockPrice(symbol: string): Promise<Partial<Stock>> {
        const cacheKey = `price_${symbol}`;
        return this.executeWithFallback(
            "getStockPrice",
            ["yahoo", "finnhub"],
            (name, provider) => provider.getStockPrice(symbol),
            cacheKey
        );
    }

    async getHistoricalData(symbol: string, period: string, fromDate?: Date): Promise<any[]> {
        const cacheKey = `historical_${symbol}_${period}`;
        return this.executeWithFallback(
            "getHistoricalData",
            ["yahoo", "finnhub"],
            (name, provider) => provider.getHistoricalData(symbol, period, fromDate),
            cacheKey
        );
    }

    async getPerformance(symbol: string, period: string): Promise<any> {
        const cacheKey = `performance_${symbol}_${period}`;
        return this.executeWithFallback(
            "getPerformance",
            ["yahoo", "finnhub"],
            (name, provider) => provider.getPerformance(symbol, period),
            cacheKey
        );
    }

    async searchStocks(query: string): Promise<Partial<Stock>[]> {
        const cacheKey = `search_${query}`;
        return this.executeWithFallback(
            "searchStocks",
            ["yahoo"],
            (name, provider) => provider.searchStocks(query),
            cacheKey
        );
    }

    async getScreenerData(scrId: string, count?: number): Promise<Partial<Stock>[]> {
        const cacheKey = `screener_${scrId}`;
        return this.executeWithFallback(
            "getScreenerData",
            ["yahoo"],
            (name, provider) => provider.getScreenerData(scrId, count),
            cacheKey
        );
    }

    async getNews(symbol: string, count?: number): Promise<any[]> {
        const cacheKey = `news_${symbol}`;
        return this.executeWithFallback(
            "getNews",
            ["yahoo"],
            (name, provider) => provider.getNews(symbol, count),
            cacheKey
        );
    }

    public getHealthReport(): Record<string, ProviderMetrics> {
        return JSON.parse(JSON.stringify(this.metrics));
    }
}
