import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getInfrastructure } from "@/infrastructure/container";
import { SignalService } from "@/application/signal-service";
import { TradeMonitorService } from "@/application/trade-monitor-service";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const infra = await getInfrastructure();
        const userId = (session.user as any).id;

        const assistant = await infra.strategyAssistant.findById(id);
        if (!assistant || assistant.userId !== userId) {
            return NextResponse.json({ error: "Assistant not found" }, { status: 404 });
        }

        // Run signal evaluation for this specific assistant
        const signalService = new SignalService(infra);
        await signalService.runAssistant(assistant);

        // Run trade monitor for positions
        const monitor = new TradeMonitorService(infra);
        await monitor.monitorAll();

        // Fetch refreshed assistant state
        const updatedAssistant = await infra.strategyAssistant.findById(id);

        return NextResponse.json({
            success: true,
            message: `Scanned strategy "${assistant.strategyName || assistant.strategySlug}" and evaluated trades.`,
            assistant: updatedAssistant
        });
    } catch (err: any) {
        console.error("Manual trigger error:", err);
        return NextResponse.json({ error: err.message || "Failed to trigger scan" }, { status: 500 });
    }
}
