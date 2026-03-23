import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getInfrastructure } from "@/infrastructure/container";
import DashboardClient from "./dashboard-client";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/auth/login");
    }

    const infrastructure = await getInfrastructure();

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

    let initialData: any[] = [];
    try {
        initialData = await Promise.all(
            symbols.map(symbol => infrastructure.market.getPerformance(symbol, "1d"))
        );
    } catch (err) {
        console.error("Dashboard initial load failed", err);
    }

    return (
        <div className="p-4 sm:p-8">
            <DashboardClient initialData={initialData} />
        </div>
    );
}
