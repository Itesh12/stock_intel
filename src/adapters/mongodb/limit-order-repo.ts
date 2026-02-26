import { Collection, Db } from "mongodb";
import { LimitOrder, LimitOrderRepository, OrderStatus } from "../../domain/limit-order";
import { v4 as uuidv4 } from "uuid";

export class MongoLimitOrderRepository implements LimitOrderRepository {
    private collection: Collection;

    constructor(db: Db) {
        this.collection = db.collection("limit_orders");
    }

    async save(order: LimitOrder): Promise<void> {
        const id = order.id || uuidv4();
        await this.collection.updateOne(
            { id },
            { $set: { ...order, id, timestamp: order.timestamp || new Date() } },
            { upsert: true }
        );
    }

    async findById(id: string): Promise<LimitOrder | null> {
        const doc = await this.collection.findOne({ id });
        return doc ? this.mapToDomain(doc) : null;
    }

    async findByUserId(userId: string): Promise<LimitOrder[]> {
        const docs = await this.collection.find({ userId }).sort({ timestamp: -1 }).toArray();
        return docs.map(doc => this.mapToDomain(doc));
    }

    async findPendingBySymbol(symbol: string): Promise<LimitOrder[]> {
        const docs = await this.collection.find({ symbol, status: 'PENDING' }).toArray();
        return docs.map(doc => this.mapToDomain(doc));
    }

    async findPending(): Promise<LimitOrder[]> {
        const docs = await this.collection.find({ status: 'PENDING' }).toArray();
        return docs.map(doc => this.mapToDomain(doc));
    }

    async updateStatus(id: string, status: OrderStatus, executedPrice?: number): Promise<void> {
        const update: any = { $set: { status } };
        if (executedPrice) {
            update.$set.executedPrice = executedPrice;
            update.$set.executedAt = new Date();
        }
        await this.collection.updateOne({ id }, update);
    }

    private mapToDomain(doc: any): LimitOrder {
        return {
            id: doc.id,
            userId: doc.userId,
            symbol: doc.symbol,
            quantity: doc.quantity,
            targetPrice: doc.targetPrice,
            type: doc.type,
            status: doc.status,
            timestamp: doc.timestamp,
            executedPrice: doc.executedPrice,
            executedAt: doc.executedAt
        };
    }
}
