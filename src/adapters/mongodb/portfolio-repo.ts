import { Db, Collection } from "mongodb";
import { Portfolio } from "../../domain/portfolio";
import { PortfolioRepository } from "../../ports/portfolio-repository";

export class MongoPortfolioRepository implements PortfolioRepository {
    private collection: Collection<Portfolio>;

    constructor(db: Db) {
        this.collection = db.collection<Portfolio>("portfolios");
    }

    async findById(id: string): Promise<Portfolio | null> {
        const doc = await this.collection.findOne({ id } as any);
        return doc ? (doc as unknown as Portfolio) : null;
    }

    async findByUserId(userId: string): Promise<Portfolio[]> {
        const docs = await this.collection.find({ userId } as any).toArray();
        return docs as unknown as Portfolio[];
    }

    async save(portfolio: Portfolio): Promise<void> {
        await this.collection.updateOne(
            { id: portfolio.id } as any,
            { $set: portfolio },
            { upsert: true }
        );
    }

    async delete(id: string): Promise<void> {
        await this.collection.deleteOne({ id } as any);
    }

    async list(): Promise<Portfolio[]> {
        const docs = await this.collection.find().toArray();
        return docs as unknown as Portfolio[];
    }
}
