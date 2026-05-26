import { v4 as uuidv4 } from "uuid";
import { IInfrastructure } from "./contracts/infrastructure";
import { AssistantTimelineEvent, TimelineEventType } from "../domain/assistant-timeline";

const FLUSH_INTERVAL_MS = 3000;   // Flush every 3 seconds
const FLUSH_BATCH_MAX = 20;       // Or immediately when buffer hits 20 items
const RETENTION_DAYS = 30;        // Terminal events expire after 30 days

/**
 * In-memory buffer for assistant timeline events.
 * Events are pushed synchronously (non-blocking) and flushed in batches
 * to avoid adding latency to the critical trading execution path.
 */
export class TimelineBufferService {
    private buffer: AssistantTimelineEvent[] = [];
    private flushTimer: ReturnType<typeof setInterval> | null = null;

    constructor(private infra: IInfrastructure) {}

    /**
     * Starts the periodic flush loop. Call once on service init.
     */
    public start(): void {
        if (this.flushTimer) return;
        this.flushTimer = setInterval(() => {
            this.flush().catch(err =>
                console.error("[TimelineBufferService] Background flush error:", err)
            );
        }, FLUSH_INTERVAL_MS);
    }

    /**
     * Stops the periodic flush loop and performs a final flush.
     */
    public async stop(): Promise<void> {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
        }
        await this.flush();
    }

    /**
     * Pushes a timeline event to the buffer (non-blocking).
     * If the buffer reaches FLUSH_BATCH_MAX, flushes immediately in the background.
     */
    public pushEvent(
        assistantId: string,
        eventType: TimelineEventType,
        title: string,
        description: string,
        metadata?: any
    ): void {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + RETENTION_DAYS);

        const event: AssistantTimelineEvent = {
            id: uuidv4(),
            assistantId,
            eventType,
            title,
            description,
            metadata,
            createdAt: new Date(),
            expiresAt
        };

        this.buffer.push(event);

        if (this.buffer.length >= FLUSH_BATCH_MAX) {
            this.flush().catch(err =>
                console.error("[TimelineBufferService] Triggered flush error:", err)
            );
        }
    }

    /**
     * Flushes all buffered events to MongoDB using insertMany.
     */
    private async flush(): Promise<void> {
        if (this.buffer.length === 0) return;
        const batch = this.buffer.splice(0, this.buffer.length);
        try {
            await this.infra.assistantTimeline.saveBatch(batch);
        } catch (err) {
            console.error(`[TimelineBufferService] Failed to flush ${batch.length} events:`, err);
            // Re-queue events on failure to avoid data loss
            this.buffer.unshift(...batch);
        }
    }
}
