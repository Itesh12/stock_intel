import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { getInfrastructure } from "@/infrastructure/container";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const infra = await getInfrastructure();
    const user = await infra.user.findByEmail(session.user.email!);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const watchlist = await infra.watchlist.findByUserId(user.id);
    if (!watchlist || !watchlist.symbols || watchlist.symbols.length === 0) {
        return NextResponse.json([]);
    }

    try {
        const performanceData = await Promise.all(
            watchlist.symbols.map(symbol => infra.market.getPerformance(symbol, "1d"))
        );
        return NextResponse.json(performanceData);
    } catch (err) {
        console.error("Watchlist data fetch failed", err);
        return NextResponse.json({ error: "Failed to fetch market data" }, { status: 500 });
    }
}
