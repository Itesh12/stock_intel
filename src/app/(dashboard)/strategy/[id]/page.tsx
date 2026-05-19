import React from 'react';
import { getInfrastructure } from "@/infrastructure/container";
import StrategyClient from "./strategy-client";
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function StrategyDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const infra = await getInfrastructure();
    const { id: slug } = await params;
    const strategy = await infra.strategy.findBySlug(slug);

    if (!strategy) {
        notFound();
    }

    // Fetch dynamic recommendations for this strategy
    let recommendations = await infra.strategy.getRecommendations(strategy.id);

    // Auto-scan if no recommendations or they are older than 1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (recommendations.length === 0 || recommendations[0].timestamp < oneHourAgo) {
        const { CanslimScanner, IntermarketScanner, BuffetScanner, IntradayScanner } = await import("@/services/quant-scanner");
        
        let scanner;
        if (slug === 'canslim') scanner = new CanslimScanner(infra);
        else if (slug === 'warren-buffet') scanner = new BuffetScanner(infra);
        else if (slug === 'intraday-strategy') scanner = new IntradayScanner(infra);
        else scanner = new IntermarketScanner(infra);

        if (recommendations.length === 0) {
            console.log(`[StrategyAPI] Empty cache for ${slug}. Executing initial blocking scan...`);
            await scanner.scan();
            recommendations = await infra.strategy.getRecommendations(strategy.id);
        } else {
            console.log(`[StrategyAPI] Recommendations stale for ${slug}. Triggering background refresh scan...`);
            // Non-blocking background scanning
            scanner.scan().catch(err => console.error("[StrategyAPI] Background scanner execution failed:", err));
        }
    }

    // Deep-serialize to plain objects to strip MongoDB BSON types (_id, ObjectId, Date)
    // which cannot cross the Next.js Server → Client Component boundary.
    const strategyData = JSON.parse(JSON.stringify({
        ...strategy,
        recommendations: recommendations.map(r => r.symbol)
    }));

    return <StrategyClient initialStrategy={strategyData} strategySlug={slug} />;
}
