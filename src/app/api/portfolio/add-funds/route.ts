import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getInfrastructure } from "@/infrastructure/container";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { amount } = await req.json();

        if (amount === undefined || amount <= 0) {
            return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
        }

        const infra = await getInfrastructure();
        const userId = (session.user as any).id;

        const portfolios = await infra.portfolio.findByUserId(userId);
        let portfolio = portfolios[0];

        if (!portfolio) {
            // Self-healing: create portfolio if missing
            portfolio = {
                id: uuidv4(),
                userId,
                name: "Default Portfolio",
                holdings: [],
                totalValue: amount,
                totalPL: 0,
                totalPLPercent: 0,
                cashBalance: amount,
                riskScore: 0,
                sectorExposure: {},
                updatedAt: new Date(),
                createdAt: new Date()
            };
        } else {
            portfolio.cashBalance += amount;
            portfolio.totalValue += amount;
            portfolio.updatedAt = new Date();
        }

        await infra.portfolio.save(portfolio);

        return NextResponse.json({
            message: `Successfully deposited ₹${amount} into virtual wallet`,
            newBalance: portfolio.cashBalance
        });

    } catch (error: any) {
        console.error("Deposit error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
