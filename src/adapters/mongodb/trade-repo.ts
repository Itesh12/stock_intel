import { Db, Collection } from "mongodb";
import { Trade } from "../../domain/trade";
import { TradeRepository } from "../../ports/trade-repository";

export class MongoTradeRepository implements TradeRepository {
    private collection: Collection<Trade>;

    constructor(db: Db) {
        this.collection = db.collection<Trade>("trades");
        // Ensure indexes for performance
        this.collection.createIndex({ userId: 1, timestamp: -1 });
    }

    async save(trade: Trade): Promise<void> {
        await this.collection.insertOne(trade);
    }

    async findByUserId(userId: string): Promise<Trade[]> {
        return await this.collection
            .find({ userId })
            .sort({ timestamp: -1 })
            .toArray();
    }

    async deleteByUserId(userId: string): Promise<void> {
        await this.collection.deleteMany({ userId });
    }
}
