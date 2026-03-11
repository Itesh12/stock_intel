import { Db, Collection } from "mongodb";

export interface PriceAlert {
    id: string;
    userId: string;
    symbol: string;
    targetPrice: number;
    condition: 'ABOVE' | 'BELOW';
    isActive: boolean;
    createdAt: Date;
    triggeredAt?: Date;
}

export class MongoAlertRepository {
    private collection: Collection<PriceAlert>;

    constructor(db: Db) {
        this.collection = db.collection<PriceAlert>("alerts");
    }

    async findByUserId(userId: string): Promise<PriceAlert[]> {
        return await this.collection.find({ userId } as any).sort({ createdAt: -1 }).toArray();
    }

    async findActiveBySymbol(symbol: string): Promise<PriceAlert[]> {
        return await this.collection.find({ symbol, isActive: true } as any).toArray();
    }

    async save(alert: PriceAlert): Promise<void> {
        await this.collection.updateOne(
            { id: alert.id } as any,
            { $set: alert },
            { upsert: true }
        );
    }

    async delete(id: string, userId: string): Promise<void> {
        await this.collection.deleteOne({ id, userId } as any);
    }
}
