import { Collection, Db } from "mongodb";
import { AutoTradeLog, AutoTradeLogRepository } from "../../domain/auto-trade-log";
import { v4 as uuidv4 } from "uuid";

export class MongoAutoTradeLogRepository implements AutoTradeLogRepository {
    private collection: Collection;

    constructor(db: Db) {
        this.collection = db.collection("auto_trade_logs");
        // Create 30-day (2,592,000 seconds) TTL Index on createdAt field
        this.collection.createIndex(
            { createdAt: 1 },
            { expireAfterSeconds: 2592000 }
        ).catch(err => {
            console.error("[MongoAutoTradeLogRepository] Failed to create TTL index on createdAt:", err);
        });
    }

    async save(log: AutoTradeLog): Promise<void> {
        const id = log.id || uuidv4();
        const timestamp = log.timestamp || new Date();
        const createdAt = log.createdAt || timestamp;
        await this.collection.insertOne({
            ...log,
            id,
            timestamp,
            createdAt
        });
    }

    async findByBotId(botId: string, limit: number = 200): Promise<AutoTradeLog[]> {
        const docs = await this.collection
            .find({ botId })
            .sort({ timestamp: -1 })
            .limit(limit)
            .toArray();
        return docs.map(d => this.map(d));
    }

    async deleteByBotId(botId: string): Promise<void> {
        await this.collection.deleteMany({ botId });
    }

    private map(doc: any): AutoTradeLog {
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
