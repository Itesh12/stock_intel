import { NextRequest, NextResponse } from "next/server";
import { getInfrastructure } from "@/infrastructure/container";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const infra = await getInfrastructure();

        // 1. Fetch all portfolios
        const portfolios = await infra.portfolio.list();
        const INITIAL_BALANCE = 1000000;

        // 2. Collect all unique symbols to fetch prices in batch
        const allSymbols = Array.from(new Set(
            portfolios.flatMap(p => p.holdings.map(h => h.symbol))
        ));

        // 3. Fetch current prices for all symbols
        const priceMap: Record<string, number> = {};
        if (allSymbols.length > 0) {
            // yahoo-finance.quote can take an array. MarketDataPort might need to expose this, 
            // but for now we'll use a Promise.all with getStockPrice which has internal caching.
            await Promise.all(allSymbols.map(async (symbol) => {
                const stock = await infra.market.getStockPrice(symbol);
                priceMap[symbol] = stock.price || 0;
            }));
        }

        // 4. Calculate real-time value for each portfolio
        const leaderboard = await Promise.all(portfolios.map(async (p) => {
            const user = await infra.user.findById(p.userId);
            
            // Calculate current market value
            const currentMarketValue = p.holdings.reduce((sum, h) => {
                const currentPrice = priceMap[h.symbol] || h.currentPrice || 0;
                return sum + (h.quantity * currentPrice);
            }, 0);

            const totalValue = p.cashBalance + currentMarketValue;
            const growth = ((totalValue - INITIAL_BALANCE) / INITIAL_BALANCE) * 100;

            return {
                userId: p.userId,
                name: user?.name || "Anonymous Alpha",
                totalValue: totalValue,
                growthPercent: growth,
                tradeCount: 0,
                rank: 0
            };
        }));

        // 5. Sort by growth (consistent with Profit %)
        leaderboard.sort((a, b) => b.growthPercent - a.growthPercent);

        // 6. Assign ranks
        leaderboard.forEach((item, index) => {
            item.rank = index + 1;
        });

        return NextResponse.json(leaderboard.slice(0, 50));

    } catch (err) {
        console.error("Leaderboard fetch failed", err);
        return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 });
    }
}
