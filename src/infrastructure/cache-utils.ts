/**
 * Cache provider interface defining caching actions and metric tracking.
 */
export interface CacheProvider {
    get<T = any>(key: string, ttl?: number): T | null;
    set(key: string, data: any, ttl?: number): void;
    getFallback(key: string): any | null;
    delete(key: string): void;
    clear(): void;
    getMetrics(): {
        hitCount: number;
        missCount: number;
        hitRatio: number;
        cacheSize: number;
    };
    resetMetrics(): void;
    getOrFetch<T>(key: string, fetchFn: () => Promise<T>, ttl?: number): Promise<T>;
}

/**
 * Standard in-memory cache provider. Supports custom TTLs, metrics tracking,
 * and stampede protection via request collapsing.
 */
export class MemoryCacheProvider implements CacheProvider {
    private cache: Record<string, { data: any; timestamp: number; ttl?: number }> = {};
    private hitCount = 0;
    private missCount = 0;
    private pendingRequests = new Map<string, Promise<any>>();
    private defaultTtl = 5 * 60 * 1000; // 5 minutes default

    get<T = any>(key: string, ttl: number = this.defaultTtl): T | null {
        const entry = this.cache[key];
        if (!entry) {
            this.missCount++;
            return null;
        }

        const actualTtl = entry.ttl !== undefined ? entry.ttl : ttl;
        const age = Date.now() - entry.timestamp;
        if (age > actualTtl) {
            this.missCount++;
            return null;
        }

        this.hitCount++;
        return entry.data as T;
    }

    set(key: string, data: any, ttl?: number): void {
        if (data === undefined || data === null) return;
        this.cache[key] = {
            data,
            timestamp: Date.now(),
            ttl
        };
    }

    getFallback(key: string): any | null {
        return this.cache[key]?.data || null;
    }

    delete(key: string): void {
        delete this.cache[key];
    }

    clear(): void {
        this.cache = {};
        this.pendingRequests.clear();
    }

    getMetrics() {
        const total = this.hitCount + this.missCount;
        const hitRatio = total > 0 ? this.hitCount / total : 0;
        return {
            hitCount: this.hitCount,
            missCount: this.missCount,
            hitRatio: Number(hitRatio.toFixed(4)),
            cacheSize: Object.keys(this.cache).length
        };
    }

    resetMetrics(): void {
        this.hitCount = 0;
        this.missCount = 0;
    }

    async getOrFetch<T>(key: string, fetchFn: () => Promise<T>, ttl?: number): Promise<T> {
        const cached = this.get<T>(key, ttl);
        if (cached !== null) {
            return cached;
        }

        // Cache Stampede / Request Collapsing Protection
        if (this.pendingRequests.has(key)) {
            return this.pendingRequests.get(key) as Promise<T>;
        }

        const promise = fetchFn()
            .then((result) => {
                this.set(key, result, ttl);
                this.pendingRequests.delete(key);
                return result;
            })
            .catch((error) => {
                this.pendingRequests.delete(key);
                throw error;
            });

        this.pendingRequests.set(key, promise);
        return promise;
    }
}

// Instantiate default provider instance
const defaultProvider = new MemoryCacheProvider();

/**
 * Backward-compatible CacheUtils wrapper that delegates to the default provider.
 */
export const CacheUtils = {
    get<T = any>(key: string, ttl?: number) {
        return defaultProvider.get<T>(key, ttl);
    },
    set(key: string, data: any, ttl?: number) {
        defaultProvider.set(key, data, ttl);
    },
    getFallback(key: string) {
        return defaultProvider.getFallback(key);
    },
    delete(key: string) {
        defaultProvider.delete(key);
    },
    clear() {
        defaultProvider.clear();
    },
    getMetrics() {
        return defaultProvider.getMetrics();
    },
    resetMetrics() {
        defaultProvider.resetMetrics();
    },
    getOrFetch<T>(key: string, fetchFn: () => Promise<T>, ttl?: number): Promise<T> {
        return defaultProvider.getOrFetch(key, fetchFn, ttl);
    }
};
