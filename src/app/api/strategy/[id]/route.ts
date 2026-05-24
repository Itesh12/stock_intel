import { NextRequest, NextResponse } from "next/server";
import { getInfrastructure } from "@/infrastructure/container";
import { CacheUtils } from "@/infrastructure/cache-utils";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const infra = await getInfrastructure();
        const { id: slug } = await params;
        const cacheKey = `strategy_${slug}`;
        const TTL = 5 * 60 * 1000; // 5 minutes TTL

        const strategyData = await CacheUtils.getOrFetch(cacheKey, async () => {
            const strategy = await infra.strategy.findBySlug(slug);

            if (!strategy) {
                return null;
            }

            // Fetch dynamic recommendations for this strategy
            let recommendations = await infra.strategy.getRecommendations(strategy.id);

            // Auto-scan if no recommendations or they are older than 1 hour
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            if (recommendations.length === 0 || recommendations[0].timestamp < oneHourAgo) {
                console.log(`[StrategyAPI] Recommendations stale for ${slug}. Triggering scan...`);
                const { CanslimScanner, IntermarketScanner, BuffetScanner, IntradayScanner, SwingScanner } = await import("@/services/quant-scanner");
                
                let scanner;
                if (slug === 'canslim') scanner = new CanslimScanner(infra);
                else if (slug === 'warren-buffet') scanner = new BuffetScanner(infra);
                else if (slug === 'intraday-strategy') scanner = new IntradayScanner(infra);
                else if (slug === 'swing-strategy') scanner = new SwingScanner(infra);
                else scanner = new IntermarketScanner(infra);

                await scanner.scan();
                recommendations = await infra.strategy.getRecommendations(strategy.id);
            }

            return {
                ...strategy,
                recommendations: recommendations.map(r => r.symbol)
            };
        }, TTL);

        if (!strategyData) {
            return NextResponse.json({ error: "Strategy not found" }, { status: 404 });
        }

        return NextResponse.json(strategyData);
    } catch (error: any) {
        console.error("Strategy fetch error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
