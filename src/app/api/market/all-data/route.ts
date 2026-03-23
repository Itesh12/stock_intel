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
    const timeframe = searchParams.get("timeframe") || "1d";

    const infra = await getInfrastructure();

    const symbols = [
        // Indian Core
        "^NSEI", "^BSESN", "^INDIAVIX",
        "^NSEBANK", "^CNXIT", "^CNXENERGY", "^CNXFMCG", "^CNXPHARMA", "^CNXMETAL",
        // Global Indices
        "^GSPC", "^IXIC", "^DJI", "^GDAXI", "^FCHI", "^N225", "^FTSE",
        // Commodities
        "GC=F", "SI=F", "CL=F",
        // Currencies
        "USDINR=X", "EURINR=X", "GBPINR=X", "JPYINR=X", "AUDINR=X", "CHFINR=X",
        // Yields
        "^IRX", "^FVX", "^TNX", "^TYX"
    ];

    try {
        const marketData = await Promise.all(
            symbols.map(symbol => infra.market.getPerformance(symbol, timeframe))
        );
        return NextResponse.json(marketData);
    } catch (err) {
        console.error("API data fetch failed", err);
        return NextResponse.json({ error: "Failed to fetch market data" }, { status: 500 });
    }
}
