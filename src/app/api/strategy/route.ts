import { NextResponse } from "next/server";
import { getInfrastructure } from "@/infrastructure/container";
import { strategies as predefinedStrategies } from "@/data/strategies";
import { CacheUtils } from "@/infrastructure/cache-utils";
import { withMetrics } from "@/middleware-metrics";

export async function GET() {
    return withMetrics('strategy', 'GET', async () => {
    try {
        const infra = await getInfrastructure();
        const cacheKey = "strategy_list";
        const TTL = 5 * 60 * 1000; // 5 minutes TTL

        const strategiesData = await CacheUtils.getOrFetch(cacheKey, async () => {
            // Clean up removed strategies
            await infra.strategy.deleteBySlug('intraday-strategy');
            await infra.strategy.deleteBySlug('swing-strategy');

            // Ensure predefined strategies are in the DB
            for (const s of predefinedStrategies) {
                await infra.strategy.save({
                    ...s,
                    slug: s.id,
                    createdAt: new Date(),
                    updatedAt: new Date()
                } as any);
            }

            const all = await infra.strategy.list();
            const valid = new Set(predefinedStrategies.map(p => p.id));
            return all.filter(item => valid.has(item.id) || valid.has(item.slug));
        }, TTL);

        return NextResponse.json(strategiesData);
    } catch (error: any) {
        console.error("Strategies fetch error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
    }); // end withMetrics
}
