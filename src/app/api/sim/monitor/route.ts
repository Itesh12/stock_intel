import { NextResponse } from "next/server";
import { getInfrastructure } from "@/infrastructure/container";
import { TradeMonitorService } from "@/application/trade-monitor-service";

export async function GET() {
    try {
        const infra = await getInfrastructure();
        const monitorService = new TradeMonitorService(infra);
        
        const results = await monitorService.monitorAll();
        
        return NextResponse.json({
            status: "SIM_SCAN_COMPLETE",
            timestamp: new Date(),
            ...results
        });
    } catch (err: any) {
        console.error("[SIM_MONITOR_API] Error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
