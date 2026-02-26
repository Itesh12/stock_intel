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
