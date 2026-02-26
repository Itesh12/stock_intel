import { NextResponse } from "next/server";
import { getInfrastructure } from "@/infrastructure/container";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol");
    const period = searchParams.get("period") || "1mo";

    if (!symbol) {
        return NextResponse.json({ error: "Symbol is required" }, { status: 400 });
    }

    try {
        const infra = await getInfrastructure();
        const performance = await infra.market.getPerformance(symbol, period);
        return NextResponse.json(performance);
    } catch (err) {
        console.error("Stock performance fetch failed", err);
        return NextResponse.json({ error: "Failed to fetch performance data" }, { status: 500 });
    }
}
