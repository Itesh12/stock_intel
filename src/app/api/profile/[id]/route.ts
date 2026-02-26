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

        const INITIAL_BALANCE = 1000000;
        const growth = portfolio ? ((portfolio.totalValue - INITIAL_BALANCE) / INITIAL_BALANCE) * 100 : 0;

        // Return public-safe data
        return NextResponse.json({
            id: user.id,
            name: user.name,
            totalValue: portfolio?.totalValue || 0,
            growthPercent: growth,
            holdingsCount: portfolio?.holdings?.length || 0,
            // Only expose symbols and weights, not exact quantities for "copy-trading" protection if desired
            // But for this demo, we can show symbols.
            holdings: portfolio?.holdings?.map(h => ({
                symbol: h.symbol,
                weight: h.weight,
                sector: h.sector
            })) || []
        });

    } catch (err) {
        console.error("Profile fetch failed", err);
        return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
    }
}
