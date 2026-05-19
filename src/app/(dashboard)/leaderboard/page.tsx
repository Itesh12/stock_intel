import React from "react";
import { getInfrastructure } from "@/infrastructure/container";
import LeaderboardClient from "./leaderboard-client";

export const dynamic = 'force-dynamic';

export default async function LeaderboardPage() {
    const infra = await getInfrastructure();
    
    // 1. Fetch all portfolios
    const portfolios = await infra.portfolio.list();
    const INITIAL_BALANCE = 1000000;

    // 2. Collect all unique symbols
    const allSymbols = Array.from(new Set(
        portfolios.flatMap(p => p.holdings.map(h => h.symbol))
    ));

    // 3. Fetch current prices
    const priceMap: Record<string, number> = {};
    if (allSymbols.length > 0) {
        await Promise.all(allSymbols.map(async (symbol) => {
            const stock = await infra.market.getStockPrice(symbol);
            priceMap[symbol] = stock.price || 0;
        }));
    }

    // 4. Calculate real-time value for each portfolio
    const leaderboard = await Promise.all(portfolios.map(async (p) => {
        const user = await infra.user.findById(p.userId);
        
        const currentMarketValue = p.holdings.reduce((sum, h) => {
            const livePrice = priceMap[h.symbol];
            const finalPrice = (livePrice && livePrice > 0) ? livePrice : (h.currentPrice || 0);
            return sum + (h.quantity * finalPrice);
        }, 0);

        const totalEquity = p.cashBalance + currentMarketValue;
        const growth = ((totalEquity - INITIAL_BALANCE) / INITIAL_BALANCE) * 100;

        return {
            userId: p.userId,
            name: user?.name || "Anonymous Alpha",
            totalValue: totalEquity,
            growthPercent: growth,
            tradeCount: 0,
            rank: 0
        };
    }));

    // 5. Sort by growth
    leaderboard.sort((a, b) => b.growthPercent - a.growthPercent);

    // 6. Assign ranks
    leaderboard.forEach((item, index) => {
        item.rank = index + 1;
    });

    const finalLeaderboard = leaderboard.slice(0, 50);

    return <LeaderboardClient initialLeaderboard={finalLeaderboard} />;
}