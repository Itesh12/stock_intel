import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getInfrastructure } from "@/infrastructure/container";

export const dynamic = "force-dynamic";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    if (process.env.ENABLE_EXPLAINABILITY !== "true") {
        return NextResponse.json({ error: "Explainability module is disabled" }, { status: 403 });
    }

    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id: assistantId } = await params;
        const infra = await getInfrastructure();
        const userId = (session.user as any).id;

        // Verify ownership
        const assistant = await infra.strategyAssistant.findById(assistantId);
        if (!assistant || assistant.userId !== userId) {
            return NextResponse.json({ error: "Assistant not found" }, { status: 404 });
        }

        const { searchParams } = new URL(req.url);
        const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);

        const events = await infra.assistantTimeline.findByAssistantId(assistantId, limit);

        return NextResponse.json({ events });
    } catch (err) {
        console.error("[GET /timeline]", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
