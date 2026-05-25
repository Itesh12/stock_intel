import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getInfrastructure } from "@/infrastructure/container";
import { AssistantLifecycleService } from "@/application/assistant-lifecycle-service";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    if (process.env.ENABLE_STRATEGY_ASSISTANTS !== "true") {
        return NextResponse.json({ error: "Strategy Assistants module is disabled" }, { status: 403 });
    }

    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = (session.user as any).id;
        const infra = await getInfrastructure();
        const body = await req.json().catch(() => ({}));
        const flattenPositions = body.flattenPositions === true;

        const lifecycle = new AssistantLifecycleService(infra);
        const result = await lifecycle.emergencyStop(userId, flattenPositions);

        return NextResponse.json({
            message: "Emergency stop executed successfully",
            pausedCount: result.pausedCount,
            cancelledCount: result.cancelledCount,
            liquidatedCount: result.liquidatedCount,
            flattened: flattenPositions
        });
    } catch (error: any) {
        console.error("Emergency stop error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
