import { Collection, Db } from "mongodb";
import { AutoTradeBot, AutoTradeBotRepository } from "../../domain/auto-trade-bot";
import { v4 as uuidv4 } from "uuid";

export class MongoAutoTradeBotRepository implements AutoTradeBotRepository {
    private collection: Collection;

    constructor(db: Db) {
        this.collection = db.collection("auto_trade_bots");
    }

    async save(bot: AutoTradeBot): Promise<void> {
        const id = bot.id || uuidv4();
        await this.collection.updateOne(
            { id },
            { $set: { ...bot, id } },
            { upsert: true }
        );
    }

    async findById(id: string): Promise<AutoTradeBot | null> {
        const doc = await this.collection.findOne({ id });
        return doc ? this.map(doc) : null;
    }

    async findByUserId(userId: string): Promise<AutoTradeBot[]> {
        const docs = await this.collection.find({ userId }).sort({ createdAt: -1 }).toArray();
        return docs.map(d => this.map(d));
    }

    async findAllActive(): Promise<AutoTradeBot[]> {
        const docs = await this.collection.find({ status: 'ACTIVE' }).toArray();
        return docs.map(d => this.map(d));
    }

    async updateStats(id: string, stats: Partial<AutoTradeBot>, session?: any): Promise<void> {
        await this.collection.updateOne(
            { id },
            { $set: { ...stats, updatedAt: new Date() } },
            { session }
        );
    }

    async delete(id: string): Promise<void> {
        await this.collection.deleteOne({ id });
    }

    private map(doc: any): AutoTradeBot {
        return {
            id: doc.id,
            userId: doc.userId,
            name: doc.name,
            strategySlug: doc.strategySlug,
            strategyName: doc.strategyName,
            status: doc.status,
            capitalAllocated: doc.capitalAllocated,
            maxPositionSizePercent: doc.maxPositionSizePercent,
            riskPerTradePercent: doc.riskPerTradePercent,
            maxTradesPerDay: doc.maxTradesPerDay,
            stopLossPercent: doc.stopLossPercent,
            takeProfitPercent: doc.takeProfitPercent,
            minConfluenceScore: doc.minConfluenceScore,
            totalTradesExecuted: doc.totalTradesExecuted || 0,
            winCount: doc.winCount || 0,
            lossCount: doc.lossCount || 0,
            totalPnL: doc.totalPnL || 0,
            todayTradeCount: doc.todayTradeCount || 0,
            todayDate: doc.todayDate || '',
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
        };
    }
}
