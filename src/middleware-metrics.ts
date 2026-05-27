// import 'server-only';
import { NextResponse } from "next/server";
import { MetricsRegistry } from "./infrastructure/metrics";
import { Logger } from "./infrastructure/logger";


/**
 * withMetrics — higher-order function for instrumenting Next.js route handlers.
 *
 * Wraps any async route handler to:
 * - Time the request
 * - Record status code + duration in MetricsRegistry
 * - Emit a structured log line
 *
 * Usage:
 *   export async function GET(req: NextRequest) {
 *       return withMetrics('portfolio/analytics', 'GET', async () => {
 *           // existing handler code returns a NextResponse
 *       });
 *   }
 *
 * The handler logic is completely unchanged — this is purely additive.
 */
export async function withMetrics(
    route: string,
    method: string,
    handler: () => Promise<NextResponse>
): Promise<NextResponse> {
    const startMs = Date.now();

    try {
        const response = await handler();
        const durationMs = Date.now() - startMs;
        const status = response.status;

        MetricsRegistry.recordApiRequest(route, method, status, durationMs);

        if (status >= 400) {
            Logger.warn('API', `${method} /${route}`, { statusCode: status, durationMs });
        } else {
            Logger.info('API', `${method} /${route}`, { statusCode: status }, durationMs);
        }

        return response;
    } catch (err: any) {
        const durationMs = Date.now() - startMs;

        MetricsRegistry.recordApiRequest(route, method, 500, durationMs);
        Logger.error('API', `${method} /${route}`, err, undefined, durationMs);

        // Re-throw so Next.js error handling still works
        throw err;
    }
}
