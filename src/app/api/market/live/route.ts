import { NextRequest } from "next/server";
import { getInfrastructure } from "@/infrastructure/container";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const infra = await getInfrastructure();
    const indices = ["^NSEI", "^BSESN"];

    const responseStream = new TransformStream();
    const writer = responseStream.writable.getWriter();
    const encoder = new TextEncoder();

    const sendEvent = (data: any) => {
        try {
            writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch (err) {
            console.error("SSE writer failed:", err);
        }
    };

    let intervalId: NodeJS.Timeout;

    // We build the stream to push updates to the client
    const stream = new ReadableStream({
        async start() {
            // Initial payload push
            try {
                const data = await Promise.all(
                    indices.map(symbol => infra.market.getStockPrice(symbol))
                );
                sendEvent(data);
            } catch (err) {
                console.error("SSE initial fetch error:", err);
            }

            // Periodic push every 5 seconds
            intervalId = setInterval(async () => {
                try {
                    const data = await Promise.all(
                        indices.map(symbol => infra.market.getStockPrice(symbol))
                    );
                    sendEvent(data);
                } catch (err) {
                    console.error("SSE fetch interval error:", err);
                }
            }, 5000);
        },
        cancel() {
            clearInterval(intervalId);
            try {
                writer.close();
            } catch (err) {
                // Ignore close errors
            }
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
