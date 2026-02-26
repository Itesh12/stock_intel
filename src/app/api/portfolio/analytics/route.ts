import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getInfrastructure } from "@/infrastructure/container";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const infra = await getInfrastructure();
        const userId = (session.user as any).id;

        // Fetch snapshots for the last 30 days
        const snapshots = await infra.analytics.getSnapshots(userId, 31);

        if (snapshots.length < 2) {
            return NextResponse.json({
                sharpeRatio: 0,
                maxDrawdown: 0,
                volatility: 0,
                history: snapshots
            });
        }

        // Calculate Daily Returns
        const returns: number[] = [];
        for (let i = 0; i < snapshots.length - 1; i++) {
            const current = snapshots[i].nav;
            const previous = snapshots[i + 1].nav;
            if (previous > 0) {
                returns.push((current - previous) / previous);
            }
        }

        // 1. Volatility (Standard Deviation of Daily Returns)
        const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((a, b) => a + Math.pow(b - meanReturn, 2), 0) / returns.length;
        const dailyVol = Math.sqrt(variance);
        const annualizedVol = dailyVol * Math.sqrt(252); // Annualizing daily vol

        // 2. Sharpe Ratio (Assuming Risk-Free Rate = 0 for simplicity)
        const annualizedReturn = meanReturn * 252;
        const sharpeRatio = annualizedVol > 0 ? annualizedReturn / annualizedVol : 0;

        // 3. Max Drawdown
        let maxNav = 0;
        let maxDd = 0;

        // Snapshots are sorted by timestamp DESC, so we iterate from end (oldest) to start (newest)
        const chronSnapshots = [...snapshots].reverse();
        for (const snap of chronSnapshots) {
            if (snap.nav > maxNav) {
                maxNav = snap.nav;
            }
            const dd = maxNav > 0 ? (maxNav - snap.nav) / maxNav : 0;
            if (dd > maxDd) {
                maxDd = dd;
            }
        }

        return NextResponse.json({
            sharpeRatio: Number(sharpeRatio.toFixed(2)),
            maxDrawdown: Number((maxDd * 100).toFixed(2)),
            volatility: Number((annualizedVol * 100).toFixed(2)),
            history: snapshots
        });

    } catch (error: any) {
        console.error("Analytics fetch error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
