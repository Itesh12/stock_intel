import React from 'react';
import { getInfrastructure } from "@/infrastructure/container";
import StrategyClient from "./strategy-client";
import { notFound } from 'next/navigation';
import { getScannerForSlug } from "@/services/scanner-registry";

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

    // Auto-scan ONLY if no recommendations at all (initial blocking scan)
    if (recommendations.length === 0) {
        console.log(`[StrategyAPI] Empty cache for ${slug}. Executing initial blocking scan...`);
        const scanner = getScannerForSlug(slug, infra);
        await scanner.scan();
        recommendations = await infra.strategy.getRecommendations(strategy.id);
    }

    // Deep-serialize to plain objects to strip MongoDB BSON types (_id, ObjectId, Date)
    // which cannot cross the Next.js Server → Client Component boundary.
    const strategyData = JSON.parse(JSON.stringify({
        ...strategy,
        recommendations: recommendations.map(r => r.symbol),
        recommendationsUpdatedAt: recommendations.length > 0 ? recommendations[0].timestamp : null
    }));

    return <StrategyClient initialStrategy={strategyData} strategySlug={slug} />;
}
