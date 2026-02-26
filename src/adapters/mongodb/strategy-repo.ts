import { Db, Collection } from "mongodb";
import { Strategy, StrategyRecommendation } from "../../domain/strategy";
import { StrategyRepository } from "../../ports/strategy-repository";

export class MongoStrategyRepository implements StrategyRepository {
    private strategies: Collection<Strategy>;
    private recommendations: Collection<StrategyRecommendation>;

    constructor(db: Db) {
        this.strategies = db.collection<Strategy>("strategies");
        this.recommendations = db.collection<StrategyRecommendation>("strategy_recommendations");
    }

    async findBySlug(slug: string): Promise<Strategy | null> {
        return await this.strategies.findOne({ slug } as any);
    }

    async list(): Promise<Strategy[]> {
        return await this.strategies.find().toArray();
    }

    async save(strategy: Strategy): Promise<void> {
        await this.strategies.updateOne(
            { slug: strategy.slug } as any,
            { $set: strategy },
            { upsert: true }
        );
    }

    async getRecommendations(strategyId: string): Promise<StrategyRecommendation[]> {
        return await this.recommendations.find({ strategyId } as any).sort({ score: -1 }).toArray();
    }

    async saveRecommendations(strategyId: string, recs: StrategyRecommendation[]): Promise<void> {
        if (recs.length === 0) return;

        // Use bulk write for efficiency
        const operations = recs.map(rec => ({
            updateOne: {
                filter: { strategyId: rec.strategyId, symbol: rec.symbol },
                update: { $set: rec },
                upsert: true
            }
        }));

        await this.recommendations.bulkWrite(operations);
    }

    async clearRecommendations(strategyId: string): Promise<void> {
        await this.recommendations.deleteMany({ strategyId } as any);
    }
}
