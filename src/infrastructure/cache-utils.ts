/**
 * Simple in-memory cache for market data to serve as a fallback
 * during transient network failures (ECONNRESET, etc.)
 */

interface CacheEntry {
    data: any;
    timestamp: number;
}

const cache: Record<string, CacheEntry> = {};
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

export const CacheUtils = {
    set(key: string, data: any) {
        if (!data) return;
        cache[key] = {
            data,
            timestamp: Date.now()
        };
    },

    get(key: string, ttl: number = DEFAULT_TTL): any | null {
        const entry = cache[key];
        if (!entry) return null;

        // Even if expired, we might want to return it as a "last resort" fallback
        // but for standard get, we check TTL.
        const age = Date.now() - entry.timestamp;
        if (age > ttl) return null;

        return entry.data;
    },

    getFallback(key: string): any | null {
        return cache[key]?.data || null;
    }
};
