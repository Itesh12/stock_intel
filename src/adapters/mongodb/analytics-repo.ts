import { Collection, Db } from "mongodb";
import { PortfolioSnapshot, AnalyticsRepository } from "../../domain/analytics";
import { v4 as uuidv4 } from "uuid";

export class MongoAnalyticsRepository implements AnalyticsRepository {
    private collection: Collection;

    constructor(db: Db) {
        this.collection = db.collection("portfolio_snapshots");
    }

    async saveSnapshot(snapshot: PortfolioSnapshot): Promise<void> {
        await this.collection.insertOne({
            ...snapshot,
            id: snapshot.id || uuidv4(),
            timestamp: snapshot.timestamp || new Date()
        });
    }

    async getSnapshots(userId: string, limit: number = 30): Promise<PortfolioSnapshot[]> {
        const docs = await this.collection
            .find({ userId })
            .sort({ timestamp: -1 })
            .limit(limit)
            .toArray();

        return docs.map(doc => ({
            id: doc.id,
            userId: doc.userId,
            nav: doc.nav,
            cash: doc.cash,
            holdingsValue: doc.holdingsValue,
            timestamp: doc.timestamp
        }));
    }

    async getLatestSnapshot(userId: string): Promise<PortfolioSnapshot | null> {
        const doc = await this.collection
            .findOne({ userId }, { sort: { timestamp: -1 } });

        if (!doc) return null;
        return {
            id: doc.id,
            userId: doc.userId,
            nav: doc.nav,
            cash: doc.cash,
            holdingsValue: doc.holdingsValue,
            timestamp: doc.timestamp
        };
    }
}
