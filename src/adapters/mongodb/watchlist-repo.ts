import { Collection, Db } from "mongodb";
import { Watchlist } from "../../domain/watchlist";
import { WatchlistRepository } from "../../ports/watchlist-repository";
import { v4 as uuidv4 } from "uuid";

export class MongoWatchlistRepository implements WatchlistRepository {
    private collection: Collection;

    constructor(db: Db) {
        this.collection = db.collection("watchlists");
    }

    async findByUserId(userId: string): Promise<Watchlist | null> {
        const doc = await this.collection.findOne({ userId });
        if (!doc) return null;
        return {
            id: doc.id,
            userId: doc.userId,
            symbols: doc.symbols,
            updatedAt: doc.updatedAt
        };
    }

    async save(watchlist: Watchlist): Promise<void> {
        await this.collection.updateOne(
            { userId: watchlist.userId },
            { $set: { ...watchlist, updatedAt: new Date() } },
            { upsert: true }
        );
    }

    async addSymbol(userId: string, symbol: string): Promise<void> {
        await this.collection.updateOne(
            { userId },
            {
                $addToSet: { symbols: symbol } as any,
                $set: { updatedAt: new Date() },
                $setOnInsert: { id: uuidv4() }
            },
            { upsert: true }
        );
    }

    async removeSymbol(userId: string, symbol: string): Promise<void> {
        await this.collection.updateOne(
            { userId },
            {
                $pull: { symbols: symbol } as any,
                $set: { updatedAt: new Date() }
            }
        );
    }
}
