import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getInfrastructure } from "@/infrastructure/container";
import { AssistantLifecycleService } from "@/application/assistant-lifecycle-service";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    if (process.env.ENABLE_STRATEGY_ASSISTANTS !== "true") {
        return NextResponse.json({ error: "Strategy Assistants module is disabled" }, { status: 403 });
    }

    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const body = await req.json().catch(() => ({}));
        const symbol = body.symbol;

        if (!symbol) {
            return NextResponse.json({ error: "Symbol is required" }, { status: 400 });
        }

        const infra = await getInfrastructure();
        const userId = (session.user as any).id;

        const assistant = await infra.strategyAssistant.findById(id);
        if (!assistant || assistant.userId !== userId) {
            return NextResponse.json({ error: "Assistant not found" }, { status: 404 });
        }

        const lifecycle = new AssistantLifecycleService(infra);
        await lifecycle.convertHoldingToManual(id, userId, symbol);

        return NextResponse.json({ message: `Holding ${symbol} successfully converted to manual control` });
    } catch (error: any) {
        console.error("Convert holding to manual error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
