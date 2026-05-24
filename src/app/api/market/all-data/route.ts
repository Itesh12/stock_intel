import { NextResponse } from "next/server";
import { getInfrastructure } from "@/infrastructure/container";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { CacheUtils } from "@/infrastructure/cache-utils";

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
        // Core Indices
        "^NSEI", "^BSESN", "^INDIAVIX",
        "^NSEBANK", "^CNXIT", "^CNXENERGY", "^CNXFMCG", "^CNXPHARMA", "^CNXMETAL",
        // Nifty 50 Constituents (Sample/Top)
        "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "ICICIBANK.NS", "BHARTIARTL.NS",
        "SBIN.NS", "INFY.NS", "LICI.NS", "ITC.NS", "HINDUNILVR.NS",
        "LT.NS", "BAJFINANCE.NS", "MARUTI.NS", "SUNPHARMA.NS", "TITAN.NS",
        "AXISBANK.NS", "ADANIENT.NS", "ULTRACEMCO.NS", "TATASTEEL.NS", "NTPC.NS",
        "KOTAKBANK.NS", "M&M.NS", "POWERGRID.NS", "TATAMOTORS.NS", "ASIANPAINT.NS",
        "COALINDIA.NS", "ADANIPORTS.NS", "JSWSTEEL.NS", "HINDALCO.NS", "GRASIM.NS",
        "LTIM.NS", "SBILIFE.NS", "BPCL.NS", "DRREDDY.NS", "CIPLA.NS",
        "BAJAJ-AUTO.NS", "TATACONSUM.NS", "BRITANNIA.NS", "INDUSINDBK.NS", "EICHERMOT.NS",
        "APOLLOHOSP.NS", "SHRIRAMFIN.NS", "ONGC.NS", "HEROMOTOCO.NS", "DIVISLAB.NS",
        "BAJAJFINSV.NS", "NESTLEIND.NS", "TECHM.NS", "WIPRO.NS", "HDFCLIFE.NS",
        // Global Indices
        "^GSPC", "^IXIC", "^DJI", "^GDAXI", "^FCHI", "^N225", "^FTSE",
        // Commodities
        "GC=F", "SI=F", "CL=F",
        // Currencies
        "USDINR=X", "EURINR=X", "GBPINR=X", "JPYINR=X", "AUDINR=X", "CHFINR=X",
        // Yields
        "^IRX", "^FVX", "^TNX", "^TYX"
    ];

    const cacheKey = `market_all_data_${timeframe}`;
    const TTL = 30 * 1000; // 30s TTL for aggregates

    try {
        const marketData = await CacheUtils.getOrFetch(cacheKey, async () => {
            return Promise.all(
                symbols.map(symbol => infra.market.getPerformance(symbol, timeframe))
            );
        }, TTL);
        return NextResponse.json(marketData);
    } catch (err) {
        console.error("API data fetch failed", err);
        return NextResponse.json({ error: "Failed to fetch market data" }, { status: 500 });
    }
}
