/**
 * Structured logger for StockIntel.
 *
 * Outputs JSON lines to stdout — compatible with any log aggregator
 * (Datadog, CloudWatch, Loki, etc.) that parses JSON from stdout.
 *
 * Format:
 * {
 *   "timestamp": "ISO8601",
 *   "level": "INFO|WARN|ERROR",
 *   "service": "TradeAPI",
 *   "action": "trade_executed",
 *   "status": "SUCCESS|FAILURE|WARNING",
 *   "metadata": { ...any context }
 * }
 */
import 'server-only';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR';
export type LogStatus = 'SUCCESS' | 'FAILURE' | 'WARNING' | 'STARTED' | 'SKIPPED';

export interface LogEntry {
    timestamp: string;
    level: LogLevel;
    service: string;
    action: string;
    status: LogStatus;
    durationMs?: number;
    metadata?: Record<string, any>;
    error?: string;
}

function write(entry: LogEntry): void {
    // Emit JSON line — readable in dev, parseable in production
    const line = JSON.stringify(entry);
    if (entry.level === 'ERROR') {
        console.error(line);
    } else if (entry.level === 'WARN') {
        console.warn(line);
    } else {
        console.log(line);
    }
}

function sanitizeError(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    return String(err);
}

export const Logger = {
    info(
        service: string,
        action: string,
        metadata?: Record<string, any>,
        durationMs?: number
    ): void {
        write({
            timestamp: new Date().toISOString(),
            level: 'INFO',
            service,
            action,
            status: 'SUCCESS',
            durationMs,
            metadata,
        });
    },

    warn(
        service: string,
        action: string,
        metadata?: Record<string, any>,
        durationMs?: number
    ): void {
        write({
            timestamp: new Date().toISOString(),
            level: 'WARN',
            service,
            action,
            status: 'WARNING',
            durationMs,
            metadata,
        });
    },

    error(
        service: string,
        action: string,
        err?: unknown,
        metadata?: Record<string, any>,
        durationMs?: number
    ): void {
        write({
            timestamp: new Date().toISOString(),
            level: 'ERROR',
            service,
            action,
            status: 'FAILURE',
            durationMs,
            error: err !== undefined ? sanitizeError(err) : undefined,
            metadata,
        });
    },

    started(service: string, action: string, metadata?: Record<string, any>): void {
        write({
            timestamp: new Date().toISOString(),
            level: 'INFO',
            service,
            action,
            status: 'STARTED',
            metadata,
        });
    },

    skipped(service: string, action: string, reason: string): void {
        write({
            timestamp: new Date().toISOString(),
            level: 'INFO',
            service,
            action,
            status: 'SKIPPED',
            metadata: { reason },
        });
    },
};
