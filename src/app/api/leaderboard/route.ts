import { NextRequest, NextResponse } from "next/server";
import { getInfrastructure } from "@/infrastructure/container";

export async function GET(req: NextRequest) {
    try {
        const infra = await getInfrastructure();

        // 1. Fetch all portfolios (In a real app, this would be a specialized aggregation)
        // For this demo, we'll fetch them all and calculate growth from 10L base
        const portfolios = await infra.portfolio.list();

        const INITIAL_BALANCE = 1000000;

        const leaderboard = await Promise.all(portfolios.map(async (p) => {
            const user = await infra.user.findById(p.userId);
            const growth = ((p.totalValue - INITIAL_BALANCE) / INITIAL_BALANCE) * 100;

            return {
                userId: p.userId,
                name: user?.name || "Anonymous Alpha",
                totalValue: p.totalValue,
                growthPercent: growth,
                tradeCount: 0, // In real app, we'd join with trades
                rank: 0 // Will be assigned after sort
            };
        }));

        // Sort by growth
        leaderboard.sort((a, b) => b.growthPercent - a.growthPercent);

        // Assign ranks
        leaderboard.forEach((item, index) => {
            item.rank = index + 1;
        });

        return NextResponse.json(leaderboard.slice(0, 50)); // Return top 50

    } catch (err) {
        console.error("Leaderboard fetch failed", err);
        return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 });
    }
}
