import { NextResponse } from "next/server";
import { getInfrastructure } from "@/infrastructure/container";
import { strategies as predefinedStrategies } from "@/data/strategies";
import { CacheUtils } from "@/infrastructure/cache-utils";

export async function GET() {
    try {
        const infra = await getInfrastructure();
        const cacheKey = "strategy_list";
        const TTL = 5 * 60 * 1000; // 5 minutes TTL

        const strategiesData = await CacheUtils.getOrFetch(cacheKey, async () => {
            // Ensure predefined strategies are in the DB
            for (const s of predefinedStrategies) {
                const existing = await infra.strategy.findBySlug(s.id); // strategy.id is used as slug in data/strategies.ts
                if (!existing) {
                    await infra.strategy.save({
                        ...s,
                        slug: s.id,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    } as any);
                }
            }

            return infra.strategy.list();
        }, TTL);

        return NextResponse.json(strategiesData);
    } catch (error: any) {
        console.error("Strategies fetch error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
