/**
 * MetricsRegistry — Centralized in-process metrics collection for StockIntel.
 *
 * Design principles:
 * - Single global singleton: all subsystems write to one place
 * - Zero external dependencies: purely in-process, no Prometheus/Datadog agents
 * - Rolling windows: API latency percentiles over last 1000 requests per route
 * - Additive only: never modifies the systems it observes
 */
// import 'server-only';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ApiRouteMetrics {
    requestCount: number;
    errorCount: number;
    latencySamples: number[]; // rolling window, capped at MAX_SAMPLES
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
    lastRequestAt?: Date;
}

export interface WorkerMetrics {
    execCount: number;
    failureCount: number;
    totalDurationMs: number;
    avgDurationMs: number;
    maxDurationMs: number;
    lastRunAt?: Date;
    lastFailureAt?: Date;
}

export interface ScannerMetrics {
    scanCount: number;
    totalSymbolsScanned: number;
    totalSymbolsFiltered: number;
    totalRecommendations: number;
    totalDurationMs: number;
    avgSymbolsScanned: number;
    avgSymbolsFiltered: number;
    avgRecommendations: number;
    avgDurationMs: number;
    lastScanAt?: Date;
}

export interface TradingMetrics {
    buyCount: number;
    sellCount: number;
    failedCount: number;
    totalOccRetries: number;
    occRetryHistogram: Record<number, number>; // retries → count
}

export interface MarketProviderMetrics {
    requestCount: number;
    failureCount: number;
    fallbackCount: number;
    totalLatencyMs: number;
    avgLatencyMs: number;
    isHealthy: boolean;
    lastSuccessAt?: Date;
    lastFailureAt?: Date;
}

export interface CacheMetricsSnapshot {
    hitCount: number;
    missCount: number;
    hitRatio: number;
    cacheSize: number;
}

export interface SystemMetricsSnapshot {
    generatedAt: Date;
    uptimeMs: number;
    api: Record<string, ApiRouteMetrics>;
    workers: Record<string, WorkerMetrics>;
    scanners: Record<string, ScannerMetrics>;
    trading: TradingMetrics;
    marketProviders: Record<string, MarketProviderMetrics>;
    cache: CacheMetricsSnapshot;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rolling window percentile helper
// ─────────────────────────────────────────────────────────────────────────────

const MAX_SAMPLES = 1000;

function computePercentile(sorted: number[], pct: number): number {
    if (sorted.length === 0) return 0;
    const idx = Math.ceil((pct / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

function updatePercentiles(metrics: ApiRouteMetrics): void {
    if (metrics.latencySamples.length === 0) return;
    const sorted = [...metrics.latencySamples].sort((a, b) => a - b);
    metrics.p50Ms = computePercentile(sorted, 50);
    metrics.p95Ms = computePercentile(sorted, 95);
    metrics.p99Ms = computePercentile(sorted, 99);
}

// ─────────────────────────────────────────────────────────────────────────────
// MetricsRegistry class
// ─────────────────────────────────────────────────────────────────────────────

class MetricsRegistryClass {
    private startedAt: Date = new Date();

    private _api: Record<string, ApiRouteMetrics> = {};
    private _workers: Record<string, WorkerMetrics> = {};
    private _scanners: Record<string, ScannerMetrics> = {};
    private _trading: TradingMetrics = {
        buyCount: 0,
        sellCount: 0,
        failedCount: 0,
        totalOccRetries: 0,
        occRetryHistogram: {},
    };
    private _market: Record<string, MarketProviderMetrics> = {};

    // ── API ──────────────────────────────────────────────────────────────────

    recordApiRequest(route: string, method: string, statusCode: number, durationMs: number): void {
        const key = `${method} ${route}`;
        if (!this._api[key]) {
            this._api[key] = {
                requestCount: 0,
                errorCount: 0,
                latencySamples: [],
                p50Ms: 0,
                p95Ms: 0,
                p99Ms: 0,
            };
        }

        const m = this._api[key];
        m.requestCount++;
        m.lastRequestAt = new Date();

        if (statusCode >= 400) {
            m.errorCount++;
        }

        // Rolling window — evict oldest if over cap
        if (m.latencySamples.length >= MAX_SAMPLES) {
            m.latencySamples.shift();
        }
        m.latencySamples.push(durationMs);
        updatePercentiles(m);
    }

    getApiMetrics(): Record<string, ApiRouteMetrics> {
        return this._api;
    }

    // ── Workers ──────────────────────────────────────────────────────────────

    recordWorkerStart(name: string): { mark: () => void } {
        const startMs = Date.now();
        return {
            mark: () => this.recordWorkerEnd(name, true, Date.now() - startMs),
        };
    }

    recordWorkerEnd(name: string, success: boolean, durationMs: number): void {
        if (!this._workers[name]) {
            this._workers[name] = {
                execCount: 0,
                failureCount: 0,
                totalDurationMs: 0,
                avgDurationMs: 0,
                maxDurationMs: 0,
            };
        }

        const m = this._workers[name];
        m.execCount++;
        m.totalDurationMs += durationMs;
        m.avgDurationMs = m.totalDurationMs / m.execCount;
        m.maxDurationMs = Math.max(m.maxDurationMs, durationMs);

        if (success) {
            m.lastRunAt = new Date();
        } else {
            m.failureCount++;
            m.lastFailureAt = new Date();
        }
    }

    getWorkerMetrics(): Record<string, WorkerMetrics> {
        return this._workers;
    }

    // ── Scanners ─────────────────────────────────────────────────────────────

    recordScan(
        slug: string,
        symbolsScanned: number,
        symbolsFiltered: number,
        recommendations: number,
        durationMs: number
    ): void {
        if (!this._scanners[slug]) {
            this._scanners[slug] = {
                scanCount: 0,
                totalSymbolsScanned: 0,
                totalSymbolsFiltered: 0,
                totalRecommendations: 0,
                totalDurationMs: 0,
                avgSymbolsScanned: 0,
                avgSymbolsFiltered: 0,
                avgRecommendations: 0,
                avgDurationMs: 0,
            };
        }

        const m = this._scanners[slug];
        m.scanCount++;
        m.totalSymbolsScanned += symbolsScanned;
        m.totalSymbolsFiltered += symbolsFiltered;
        m.totalRecommendations += recommendations;
        m.totalDurationMs += durationMs;
        m.avgSymbolsScanned = m.totalSymbolsScanned / m.scanCount;
        m.avgSymbolsFiltered = m.totalSymbolsFiltered / m.scanCount;
        m.avgRecommendations = m.totalRecommendations / m.scanCount;
        m.avgDurationMs = m.totalDurationMs / m.scanCount;
        m.lastScanAt = new Date();
    }

    getScannerMetrics(): Record<string, ScannerMetrics> {
        return this._scanners;
    }

    // ── Trading ──────────────────────────────────────────────────────────────

    recordTrade(type: 'BUY' | 'SELL', success: boolean, occRetries: number): void {
        if (!success) {
            this._trading.failedCount++;
            return;
        }

        if (type === 'BUY') this._trading.buyCount++;
        else this._trading.sellCount++;

        if (occRetries > 0) {
            this._trading.totalOccRetries += occRetries;
            const bin = occRetries;
            this._trading.occRetryHistogram[bin] = (this._trading.occRetryHistogram[bin] || 0) + 1;
        }
    }

    getTradingMetrics(): TradingMetrics {
        return this._trading;
    }

    // ── Market Providers ─────────────────────────────────────────────────────

    recordMarketRequest(
        provider: string,
        success: boolean,
        latencyMs: number,
        wasFallback: boolean = false
    ): void {
        if (!this._market[provider]) {
            this._market[provider] = {
                requestCount: 0,
                failureCount: 0,
                fallbackCount: 0,
                totalLatencyMs: 0,
                avgLatencyMs: 0,
                isHealthy: true,
            };
        }

        const m = this._market[provider];
        m.requestCount++;
        m.totalLatencyMs += latencyMs;
        m.avgLatencyMs = m.totalLatencyMs / m.requestCount;

        if (success) {
            m.isHealthy = true;
            m.lastSuccessAt = new Date();
        } else {
            m.failureCount++;
            m.lastFailureAt = new Date();
        }

        if (wasFallback) {
            m.fallbackCount++;
        }
    }

    getMarketMetrics(): Record<string, MarketProviderMetrics> {
        return this._market;
    }

    // ── Snapshot ─────────────────────────────────────────────────────────────

    /**
     * Returns a complete system metrics snapshot suitable for the admin endpoint
     * and future monitoring dashboards.
     * Cache metrics are read from CacheUtils at snapshot time to avoid duplication.
     */
    snapshot(cacheMetrics?: CacheMetricsSnapshot): SystemMetricsSnapshot {
        return {
            generatedAt: new Date(),
            uptimeMs: Date.now() - this.startedAt.getTime(),
            api: JSON.parse(JSON.stringify(this._api)),
            workers: JSON.parse(JSON.stringify(this._workers)),
            scanners: JSON.parse(JSON.stringify(this._scanners)),
            trading: JSON.parse(JSON.stringify(this._trading)),
            marketProviders: JSON.parse(JSON.stringify(this._market)),
            cache: cacheMetrics ?? { hitCount: 0, missCount: 0, hitRatio: 0, cacheSize: 0 },
        };
    }

    /** Reset all counters (useful for testing). */
    reset(): void {
        this._api = {};
        this._workers = {};
        this._scanners = {};
        this._trading = {
            buyCount: 0,
            sellCount: 0,
            failedCount: 0,
            totalOccRetries: 0,
            occRetryHistogram: {},
        };
        this._market = {};
        this.startedAt = new Date();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton export — safe for both Node.js (global) and browser (module-level)
// ─────────────────────────────────────────────────────────────────────────────

const GLOBAL_KEY = '__stockintel_metrics_registry__';

// Use globalThis which is defined in all environments (Node.js, browser, Edge)
const _globalThis = typeof globalThis !== 'undefined' ? globalThis : ({} as any);

if (!(_globalThis as any)[GLOBAL_KEY]) {
    (_globalThis as any)[GLOBAL_KEY] = new MetricsRegistryClass();
}

export const MetricsRegistry: MetricsRegistryClass = (_globalThis as any)[GLOBAL_KEY];
