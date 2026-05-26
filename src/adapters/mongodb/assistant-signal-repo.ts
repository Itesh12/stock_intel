import { Collection, Db } from "mongodb";
import { AssistantSignal, AssistantSignalRepository, SignalStatus, DecisionReasoning } from "../../domain/assistant-signal";

export class MongoAssistantSignalRepository implements AssistantSignalRepository {
    private collection: Collection<AssistantSignal>;

    constructor(db: Db) {
        this.collection = db.collection<AssistantSignal>("assistant_signals");
        
        // Setup indexes
        this.collection.createIndex({ assistantId: 1 }).catch(err => {
            console.error("[MongoAssistantSignalRepository] Failed to create index on assistantId:", err);
        });
        this.collection.createIndex({ status: 1 }).catch(err => {
            console.error("[MongoAssistantSignalRepository] Failed to create index on status:", err);
        });
        this.collection.createIndex({ symbol: 1 }).catch(err => {
            console.error("[MongoAssistantSignalRepository] Failed to create index on symbol:", err);
        });
        // TTL index on expiresAt field
        this.collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch(err => {
            console.error("[MongoAssistantSignalRepository] Failed to create TTL index on expiresAt:", err);
        });
    }

    async save(signal: AssistantSignal): Promise<void> {
        await this.collection.updateOne(
            { id: signal.id },
            { $set: signal },
            { upsert: true }
        );
    }

    async findById(id: string): Promise<AssistantSignal | null> {
        return await this.collection.findOne({ id });
    }

    async findByAssistantId(assistantId: string, limit: number = 50): Promise<AssistantSignal[]> {
        return await this.collection
            .find({ assistantId })
            .sort({ createdAt: -1 })
            .limit(limit)
            .toArray();
    }

    async updateStatus(
        id: string, 
        status: SignalStatus, 
        reasoning?: DecisionReasoning, 
        expiresAt?: Date | null
    ): Promise<void> {
        const updateDoc: any = {
            $set: {
                status,
                updatedAt: new Date()
            }
        };

        if (reasoning !== undefined) {
            updateDoc.$set.reasoning = reasoning;
        }

        if (expiresAt !== undefined) {
            updateDoc.$set.expiresAt = expiresAt;
        }

        await this.collection.updateOne({ id }, updateDoc);
    }

    async pruneExpired(expirationTime: Date): Promise<number> {
        const result = await this.collection.deleteMany({
            expiresAt: { $lt: expirationTime }
        });
        return result.deletedCount || 0;
    }
}
