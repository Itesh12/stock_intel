import { NextResponse } from "next/server";
import { getInfrastructure } from "@/infrastructure/container";
import { SignalProcessor } from "@/application/signal-processor";
import { TradeMonitorService } from "@/application/trade-monitor-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Max execution duration on Vercel Pro/Hobby

export async function GET(req: Request) {
    return handleCron(req);
}

export async function POST(req: Request) {
    return handleCron(req);
}

async function handleCron(req: Request) {
    // 1. Verify authorization for Vercel Cron or local trigger
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET || "stock_intel_secret_key_12345";

    // Vercel Cron sends "Bearer <CRON_SECRET>"
    // Also allow localhost/dev or matched secret query param
    const url = new URL(req.url);
    const querySecret = url.searchParams.get("secret");

    const isAuthorized = 
        authHeader === `Bearer ${cronSecret}` || 
        querySecret === cronSecret ||
        process.env.NODE_ENV === "development";

    if (!isAuthorized) {
        return NextResponse.json({ error: "Unauthorized cron execution" }, { status: 401 });
    }

    const startTime = Date.now();

    try {
        const infra = await getInfrastructure();

        // 2. Run Auto-Trade Signal Evaluation & Execution
        const processor = new SignalProcessor(infra);
        await processor.runAll();

        // 3. Run Live Price Monitoring & Stop-Loss / Take-Profit Auto-Sells
        const monitor = new TradeMonitorService(infra);
        await monitor.monitorAll();

        const durationMs = Date.now() - startTime;

        return NextResponse.json({
            success: true,
            message: "Auto-trade tick executed successfully",
            durationMs,
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        console.error("[Cron:AutoTrade] Execution error:", error);
        return NextResponse.json({
            success: false,
            error: error.message || "Failed to execute auto-trade cron",
            durationMs: Date.now() - startTime
        }, { status: 500 });
    }
}
