import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { MetricsRegistry } from "@/infrastructure/metrics";
import { CacheUtils } from "@/infrastructure/cache-utils";
import { getInfrastructure } from "@/infrastructure/container";
import { HybridMarketAdapter } from "@/adapters/hybrid/market-adapter";

export const dynamic = "force-dynamic";

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Read cache metrics from the existing CacheUtils (frozen — read only)
    const cacheMetrics = CacheUtils.getMetrics();

    // Read market provider health from HybridMarketAdapter if available
    // We pull it through infrastructure to avoid direct instantiation
    let marketProviderHealth: Record<string, any> = {};
    try {
        const infra = await getInfrastructure();
        const adapter = infra.market as HybridMarketAdapter;
        if (typeof adapter.getHealthReport === 'function') {
            marketProviderHealth = adapter.getHealthReport();
        }
    } catch {
        // If infra not available at this point, skip — non-fatal
    }

    // Build full snapshot and merge in real provider health from adapter
    const snapshot = MetricsRegistry.snapshot(cacheMetrics);

    // Merge provider health data from HybridMarketAdapter into our market section
    // (adapter has richer data: circuit breaker state, unhealthyUntil, etc.)
    for (const [provider, health] of Object.entries(marketProviderHealth)) {
        const existing = snapshot.marketProviders[provider];
        snapshot.marketProviders[provider] = {
            ...(existing ?? {
                requestCount: 0,
                failureCount: 0,
                fallbackCount: 0,
                totalLatencyMs: 0,
                avgLatencyMs: 0,
                isHealthy: true,
            }),
            // Enrich with live circuit-breaker state from HybridMarketAdapter
            isHealthy: (health as any).isHealthy,
            // Prefer adapter's richer latency data if our counter is 0
            avgLatencyMs: existing?.avgLatencyMs || (health as any).averageLatencyMs || 0,
            requestCount: existing?.requestCount || (health as any).requestCount || 0,
            failureCount: existing?.failureCount || (health as any).failureCount || 0,
            // Extra adapter-only fields stored as part of the spread (type-safe via any cast)
            ...(({
                consecutiveFailures: (health as any).consecutiveFailures,
                unhealthyUntil: (health as any).unhealthyUntil,
                lastSuccessAt: (health as any).lastSuccessfulRequest,
                lastFailureAt: (health as any).lastFailureTime,
            }) as any),
        };
    }

    return NextResponse.json(snapshot);
}
