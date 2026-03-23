import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getInfrastructure } from "@/infrastructure/container";
import { v4 as uuidv4 } from "uuid";

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const infra = await getInfrastructure();
        const userId = (session.user as any).id;

        const portfolios = await infra.portfolio.findByUserId(userId);
        let portfolio = portfolios[0] || null;

        if (portfolio) {
            // Centralized analysis using PortfolioAnalyzer
            const analyzer = new (require("@/application/portfolio-analyzer").PortfolioAnalyzer)(
                infra.stock, 
                infra.notification, 
                infra.trade,
                infra.market
            );
            portfolio = await analyzer.analyze(portfolio);

            // SIM Monitor Heartbeat - Automated execution on fetch
            const monitor = new (require("@/application/trade-monitor-service").TradeMonitorService)(infra);
            await monitor.monitorAll();
            
            return NextResponse.json(portfolio);
        }

        return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
    } catch (error: any) {
        console.error("Portfolio fetch error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
