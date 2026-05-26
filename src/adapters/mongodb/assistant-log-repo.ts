import { Collection, Db } from "mongodb";
import { AssistantLog, AssistantLogRepository } from "../../domain/assistant-log";
import { v4 as uuidv4 } from "uuid";

export class MongoAssistantLogRepository implements AssistantLogRepository {
    private collection: Collection;

    constructor(db: Db) {
        this.collection = db.collection("assistant_logs");
        // Create 30-day (2,592,000 seconds) TTL Index on createdAt field
        this.collection.createIndex(
            { createdAt: 1 },
            { expireAfterSeconds: 2592000 }
        ).catch(err => {
            console.error("[MongoAssistantLogRepository] Failed to create TTL index on createdAt:", err);
        });

        // Safe migration logic: Migrate legacy logs if auto_trade_logs exists and assistant_logs is empty
        this.migrateLegacyLogs(db).catch(err => {
            console.error("[MongoAssistantLogRepository] Legacy logs migration failed:", err);
        });
    }

    private async migrateLegacyLogs(db: Db): Promise<void> {
        try {
            const collections = await db.listCollections({ name: "auto_trade_logs" }).toArray();
            if (collections.length === 0) return; // No legacy collection

            const assistantLogsCount = await this.collection.countDocuments();
            if (assistantLogsCount > 0) return; // Already migrated or initialized

            const legacyCollection = db.collection("auto_trade_logs");
            const legacyLogsCount = await legacyCollection.countDocuments();
            if (legacyLogsCount === 0) return;

            console.log(`[MongoAssistantLogRepository] Migrating ${legacyLogsCount} logs from auto_trade_logs to assistant_logs...`);
            const cursor = legacyCollection.find({});
            const legacyLogs = await cursor.toArray();

            // Bulk write in batches of 1000
            const batchSize = 1000;
            for (let i = 0; i < legacyLogs.length; i += batchSize) {
                const batch = legacyLogs.slice(i, i + batchSize).map(doc => ({
                    id: doc.id,
                    botId: doc.botId || doc.assistantId,
                    timestamp: doc.timestamp || new Date(),
                    level: doc.level || "INFO",
                    category: doc.category || "SYSTEM",
                    message: doc.message || "",
                    metadata: doc.metadata,
                    createdAt: doc.createdAt || doc.timestamp || new Date()
                }));
                await this.collection.insertMany(batch);
            }
            console.log(`[MongoAssistantLogRepository] Successfully migrated ${legacyLogs.length} logs.`);
        } catch (err) {
            console.error("[MongoAssistantLogRepository] Error migrating legacy auto_trade_logs:", err);
        }
    }

    async save(log: AssistantLog, session?: any): Promise<void> {
        const id = log.id || uuidv4();
        const timestamp = log.timestamp || new Date();
        const createdAt = log.createdAt || timestamp;
        await this.collection.insertOne({
            ...log,
            id,
            timestamp,
            createdAt
        }, { session });
    }

    async findByBotId(botId: string, limit: number = 200): Promise<AssistantLog[]> {
        const docs = await this.collection
            .find({ botId })
            .sort({ timestamp: -1 })
            .limit(limit)
            .toArray();
        return docs.map(d => this.map(d));
    }

    async deleteByBotId(botId: string, session?: any): Promise<void> {
        await this.collection.deleteMany({ botId }, { session });
    }

    private map(doc: any): AssistantLog {
        return {
            id: doc.id,
            botId: doc.botId,
            timestamp: doc.timestamp,
            level: doc.level,
            category: doc.category,
            message: doc.message,
            metadata: doc.metadata,
            createdAt: doc.createdAt
        };
    }
}
