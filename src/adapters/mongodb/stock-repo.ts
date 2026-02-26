import { Db, Collection } from "mongodb";
import { Stock } from "../../domain/stock";
import { StockRepository } from "../../ports/stock-repository";

export class MongoStockRepository implements StockRepository {
    private collection: Collection<Stock>;

    constructor(db: Db) {
        this.collection = db.collection<Stock>("stocks");
    }

    async findById(id: string): Promise<Stock | null> {
        const doc = await this.collection.findOne({ id } as any);
        return doc ? (doc as unknown as Stock) : null;
    }

    async findBySymbol(symbol: string): Promise<Stock | null> {
        const doc = await this.collection.findOne({ symbol } as any);
        return doc ? (doc as unknown as Stock) : null;
    }

    async save(stock: Stock): Promise<void> {
        await this.collection.updateOne(
            { id: stock.id } as any,
            { $set: stock },
            { upsert: true }
        );
    }

    async list(): Promise<Stock[]> {
        const docs = await this.collection.find().toArray();
        return docs as unknown as Stock[];
    }

    async delete(id: string): Promise<void> {
        await this.collection.deleteOne({ id } as any);
    }
}
