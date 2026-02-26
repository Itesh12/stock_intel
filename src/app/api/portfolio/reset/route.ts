import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getInfrastructure } from "@/infrastructure/container";
import { v4 as uuidv4 } from "uuid";

export async function POST() {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const infra = await getInfrastructure();
        const userId = (session.user as any).id;

        // Reset Portfolio
        const portfolios = await infra.portfolio.findByUserId(userId);
        let portfolio = portfolios[0];

        if (portfolio) {
            portfolio.holdings = [];
            portfolio.cashBalance = 1000000;
            portfolio.totalValue = 1000000;
            portfolio.totalPL = 0;
            portfolio.totalPLPercent = 0;
            portfolio.updatedAt = new Date();
            await infra.portfolio.save(portfolio);
        } else {
            // Create if missing
            await infra.portfolio.save({
                id: uuidv4(),
                userId,
                name: "Default Portfolio",
                holdings: [],
                totalValue: 1000000,
                totalPL: 0,
                totalPLPercent: 0,
                cashBalance: 1000000,
                riskScore: 0,
                sectorExposure: {},
                updatedAt: new Date(),
                createdAt: new Date()
            });
        }

        // Optional: Wipe trade history on reset?
        // Let's keep history for now as an audit trail, or wipe it if specified.
        await infra.trade.deleteByUserId(userId);

        return NextResponse.json({ message: "Portfolio reset successfully" });
    } catch (error: any) {
        console.error("Reset error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
