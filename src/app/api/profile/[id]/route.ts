import { NextRequest, NextResponse } from "next/server";
import { getInfrastructure } from "@/infrastructure/container";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const infra = await getInfrastructure();

        const user = await infra.user.findById(id);
        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const portfolios = await infra.portfolio.findByUserId(id);
        const portfolio = portfolios[0];

        if (!portfolio) {
            return NextResponse.json({
                id: user.id,
                name: user.name,
                totalValue: 0,
                growthPercent: 0,
                holdingsCount: 0,
                holdings: []
            });
        }

        // Fetch live performance for each holding to show real-time P&L
        const updatedHoldings = await Promise.all(
            portfolio.holdings.map(async (h) => {
                try {
                    const perf = await infra.market.getPerformance(h.symbol, "1d");
                    const unrealizedPL = (perf.currentPrice - h.averagePrice) * h.quantity;
                    const unrealizedPLPercent = h.averagePrice > 0 
                        ? ((perf.currentPrice - h.averagePrice) / h.averagePrice) * 100 
                        : 0;

                    return {
                        ...h,
                        currentPrice: perf.currentPrice,
                        unrealizedPL,
                        unrealizedPLPercent,
                        marketValue: h.quantity * perf.currentPrice,
                        changePercent: perf.changePercent
                    };
                } catch (err) {
                    return h;
                }
            })
        );

        const INITIAL_BALANCE = 1000000;
        const totalValue = portfolio.cashBalance + updatedHoldings.reduce((sum, h) => sum + (h.marketValue || 0), 0);
        const growth = ((totalValue - INITIAL_BALANCE) / INITIAL_BALANCE) * 100;

        // Return public-safe data
        return NextResponse.json({
            id: user.id,
            name: user.name,
            totalValue,
            growthPercent: growth,
            holdingsCount: updatedHoldings.length,
            holdings: updatedHoldings.map(h => ({
                symbol: h.symbol,
                quantity: h.quantity,
                averagePrice: h.averagePrice,
                currentPrice: h.currentPrice,
                unrealizedPL: h.unrealizedPL,
                unrealizedPLPercent: h.unrealizedPLPercent,
                marketValue: h.marketValue,
                weight: (h.marketValue / (totalValue - portfolio.cashBalance)) * 100,
                sector: h.sector
            }))
        });

    } catch (err) {
        console.error("Profile fetch failed", err);
        return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
    }
}
