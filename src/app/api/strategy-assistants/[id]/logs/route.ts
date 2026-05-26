import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getInfrastructure } from "@/infrastructure/container";
import { globalEvents } from "@/infrastructure/events";

export const dynamic = "force-dynamic";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    if (process.env.ENABLE_STRATEGY_ASSISTANTS !== "true") {
        return NextResponse.json({ error: "Strategy Assistants module is disabled" }, { status: 403 });
    }

    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id: assistantId } = await params;
        const infra = await getInfrastructure();
        const userId = (session.user as any).id;

        // Verify assistant belongs to user
        const assistant = await infra.strategyAssistant.findById(assistantId);
        if (!assistant || assistant.userId !== userId) {
            return NextResponse.json({ error: "Assistant not found" }, { status: 404 });
        }

        // Parse query params to detect if SSE stream is requested
        const { searchParams } = new URL(req.url);
        const isStream = searchParams.get("stream") === "true";

        if (isStream && process.env.ENABLE_ASSISTANT_SSE === "true") {
            const encoder = new TextEncoder();
            const stream = new ReadableStream({
                start(controller) {
                    const logListener = (log: any) => {
                        const data = JSON.stringify(log);
                        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                    };

                    // Subscribe to process-level EventEmitter singleton
                    globalEvents.on(`log:${assistantId}`, logListener);

                    // 15-second heartbeat to keep Vercel/proxies from killing the connection
                    const heartbeat = setInterval(() => {
                        controller.enqueue(encoder.encode(`: heartbeat\n\n`));
                    }, 15000);

                    // Cleanup subscription on client close
                    req.signal.addEventListener("abort", () => {
                        globalEvents.off(`log:${assistantId}`, logListener);
                        clearInterval(heartbeat);
                        try {
                            controller.close();
                        } catch (err) {
                            // Already closed
                        }
                    });
                }
            });

            return new Response(stream, {
                headers: {
                    "Content-Type": "text/event-stream",
                    "Cache-Control": "no-cache, no-transform",
                    "Connection": "keep-alive",
                },
            });
        }

        // Default: Return historical logs list
        const logs = await infra.assistantLog.findByBotId(assistantId, 200);
        // MongoDB findByBotId returns in reverse chronological order (-1 timestamp), 
        // we reverse it so the client receives them chronological (oldest first) for terminal render.
        return NextResponse.json(logs.reverse());
    } catch (error: any) {
        console.error("Fetch assistant logs error:", error);
        return NextResponse.json(
            { error: error.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}
