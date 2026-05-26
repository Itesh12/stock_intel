import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getInfrastructure } from "@/infrastructure/container";

export const dynamic = "force-dynamic";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string; signalId: string }> }
) {
    if (process.env.ENABLE_EXPLAINABILITY !== "true") {
        return NextResponse.json({ error: "Explainability module is disabled" }, { status: 403 });
    }

    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id: assistantId, signalId } = await params;
        const infra = await getInfrastructure();
        const userId = (session.user as any).id;

        // Verify assistant ownership
        const assistant = await infra.strategyAssistant.findById(assistantId);
        if (!assistant || assistant.userId !== userId) {
            return NextResponse.json({ error: "Assistant not found" }, { status: 404 });
        }

        // Fetch the specific signal and its embedded reasoning
        const signal = await infra.assistantSignal.findById(signalId);
        if (!signal || signal.assistantId !== assistantId) {
            return NextResponse.json({ error: "Signal not found" }, { status: 404 });
        }

        return NextResponse.json({
            signalId: signal.id,
            symbol: signal.symbol,
            strategy: signal.strategy,
            score: signal.score,
            confidence: signal.confidence,
            status: signal.status,
            reasoning: signal.reasoning,
            createdAt: signal.createdAt,
            updatedAt: signal.updatedAt
        });
    } catch (err) {
        console.error("[GET /reasoning]", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
