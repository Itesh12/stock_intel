import { NextRequest, NextResponse } from "next/server";
import { getInfrastructure } from "@/infrastructure/container";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const infra = await getInfrastructure();
        const { id: slug } = await params;
        const strategy = await infra.strategy.findBySlug(slug);

        if (!strategy) {
            return NextResponse.json({ error: "Strategy not found" }, { status: 404 });
        }

        // Fetch dynamic recommendations for this strategy
        let recommendations = await infra.strategy.getRecommendations(strategy.id);

        // Auto-scan if no recommendations or they are older than 1 hour
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        if (recommendations.length === 0 || recommendations[0].timestamp < oneHourAgo) {
            console.log(`[StrategyAPI] Recommendations stale for ${slug}. Triggering scan...`);
            const { CanslimScanner } = await import("@/services/quant-scanner");
            const scanner = new CanslimScanner(infra);
            await scanner.scan();
            recommendations = await infra.strategy.getRecommendations(strategy.id);
        }

        return NextResponse.json({
            ...strategy,
            recommendations: recommendations.map(r => r.symbol)
        });
    } catch (error: any) {
        console.error("Strategy fetch error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
