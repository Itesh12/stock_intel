import { Collection, Db } from "mongodb";
import { AssistantTimelineEvent, AssistantTimelineRepository } from "../../domain/assistant-timeline";

export class MongoAssistantTimelineRepository implements AssistantTimelineRepository {
    private collection: Collection<AssistantTimelineEvent>;

    constructor(db: Db) {
        this.collection = db.collection<AssistantTimelineEvent>("assistant_timeline");

        // Setup indexes
        this.collection.createIndex({ assistantId: 1 }).catch(err => {
            console.error("[MongoAssistantTimelineRepository] Failed to create index on assistantId:", err);
        });
        this.collection.createIndex({ createdAt: -1 }).catch(err => {
            console.error("[MongoAssistantTimelineRepository] Failed to create index on createdAt:", err);
        });
        // TTL index on expiresAt field
        this.collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch(err => {
            console.error("[MongoAssistantTimelineRepository] Failed to create TTL index on expiresAt:", err);
        });
    }

    async saveBatch(events: AssistantTimelineEvent[]): Promise<void> {
        if (events.length === 0) return;
        await this.collection.insertMany(events);
    }

    async findByAssistantId(assistantId: string, limit: number = 100): Promise<AssistantTimelineEvent[]> {
        return await this.collection
            .find({ assistantId })
            .sort({ createdAt: -1 })
            .limit(limit)
            .toArray();
    }
}
