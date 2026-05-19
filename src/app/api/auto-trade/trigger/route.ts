import { NextResponse } from "next/server";
import { getInfrastructure } from "@/infrastructure/container";
import { AutoTradeService } from "@/application/auto-trade-service";
import { TradeMonitorService } from "@/application/trade-monitor-service";

export async function POST(req: Request) {
    try {
        // 1. Optional Security Header Check (prevent DDoS/unauthorized trigger)
        const authHeader = req.headers.get("authorization");
        const cronSecret = process.env.CRON_SECRET;

        if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: "Unauthorized trigger key" }, { status: 401 });
        }

        const infra = await getInfrastructure();

        console.log("[Cron-Trigger] Starting scheduled background tasks...");

        // 2. Trigger limit order/stop-loss/take-profit check
        const monitor = new TradeMonitorService(infra);
        const monitorResult = await monitor.monitorAll();

        // 3. Trigger auto-trade bot rules check
        const autoTrader = new AutoTradeService(infra);
        await autoTrader.runAllBots();

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            limitOrders: monitorResult
        });
    } catch (error: any) {
        console.error("[Cron-Trigger] Execution failed:", error);
        return NextResponse.json({ error: error.message || "Cron trigger execution failed" }, { status: 500 });
    }
}
