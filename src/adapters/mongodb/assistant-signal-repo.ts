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

    async save(signal: AssistantSignal, session?: any): Promise<void> {
        await this.collection.updateOne(
            { id: signal.id },
            { $set: signal },
            { upsert: true, session }
        );
    }

    async findById(id: string, session?: any): Promise<AssistantSignal | null> {
        return await this.collection.findOne({ id }, { session });
    }

    async findByAssistantId(assistantId: string, limit: number = 50, session?: any): Promise<AssistantSignal[]> {
        return await this.collection
            .find({ assistantId }, { session })
            .sort({ createdAt: -1 })
            .limit(limit)
            .toArray();
    }

    async updateStatus(
        id: string, 
        status: SignalStatus, 
        reasoning?: DecisionReasoning, 
        expiresAt?: Date | null,
        session?: any
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

        await this.collection.updateOne({ id }, updateDoc, { session });
    }

    async pruneExpired(expirationTime: Date, session?: any): Promise<number> {
        const result = await this.collection.deleteMany({
            expiresAt: { $lt: expirationTime }
        }, { session });
        return result.deletedCount || 0;
    }

    async deleteByAssistantId(assistantId: string, session?: any): Promise<void> {
        await this.collection.deleteMany({ assistantId }, { session });
    }
}
