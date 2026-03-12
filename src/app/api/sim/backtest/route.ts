import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getInfrastructure } from "@/infrastructure/container";
import { BacktestService } from "@/application/backtest-service";

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { symbol, initialCapital, days } = await req.json();

        if (!symbol) {
            return NextResponse.json({ error: "Symbol is required" }, { status: 400 });
        }

        const infra = await getInfrastructure();
        const backtestService = new BacktestService(infra);
        const userId = (session.user as any).id;

        const result = await backtestService.runSimpleBacktest(
            userId,
            symbol,
            initialCapital || 1000000,
            days || 365
        );

        return NextResponse.json(result);

    } catch (error: any) {
        console.error("Backtest failed:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
