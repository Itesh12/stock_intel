import { Collection, Db } from "mongodb";
import { StrategyAssistant, StrategyAssistantRepository } from "../../domain/strategy-assistant";
import { v4 as uuidv4 } from "uuid";

export class MongoStrategyAssistantRepository implements StrategyAssistantRepository {
    private collection: Collection;

    constructor(db: Db) {
        this.collection = db.collection("strategy_assistants");
    }

    async save(assistant: StrategyAssistant, session?: any): Promise<void> {
        const id = assistant.id || uuidv4();
        await this.collection.updateOne(
            { id },
            { $set: { ...assistant, id, updatedAt: new Date() } },
            { upsert: true, session }
        );
    }

    async findById(id: string, session?: any): Promise<StrategyAssistant | null> {
        const doc = await this.collection.findOne({ id }, { session });
        return doc ? this.map(doc) : null;
    }

    async findByUserId(userId: string): Promise<StrategyAssistant[]> {
        const docs = await this.collection.find({ userId }).sort({ createdAt: -1 }).toArray();
        return docs.map(d => this.map(d));
    }

    async findAllRunning(): Promise<StrategyAssistant[]> {
        const docs = await this.collection.find({ status: 'RUNNING' }).toArray();
        return docs.map(d => this.map(d));
    }

    async findRunningByStrategy(strategySlug: string): Promise<StrategyAssistant[]> {
        const docs = await this.collection.find({ strategySlug, status: 'RUNNING' }).toArray();
        return docs.map(d => this.map(d));
    }

    async updateStats(id: string, stats: Partial<StrategyAssistant>, session?: any): Promise<void> {
        await this.collection.updateOne(
            { id },
            { $set: { ...stats, updatedAt: new Date() } },
            { session }
        );
    }

    async delete(id: string, session?: any): Promise<void> {
        await this.collection.deleteOne({ id }, { session });
    }

    private map(doc: any): StrategyAssistant {
        return {
            id: doc.id,
            userId: doc.userId,
            name: doc.name,
            strategySlug: doc.strategySlug,
            strategyName: doc.strategyName,
            status: doc.status,
            mode: doc.mode || 'paper',
            allocatedCapital: doc.allocatedCapital !== undefined ? doc.allocatedCapital : (doc.capitalAllocated || 0),
            deployedCapital: doc.deployedCapital || 0,
            maxPositionSizePercent: doc.maxPositionSizePercent,
            stopLossPercent: doc.stopLossPercent,
            takeProfitPercent: doc.takeProfitPercent,
            useTrailingStop: doc.useTrailingStop || false,
            minConfluenceScore: doc.minConfluenceScore,
            maxDailyLoss: doc.maxDailyLoss || 0,
            maxConcurrentPositions: doc.maxConcurrentPositions !== undefined ? doc.maxConcurrentPositions : 3,
            cooldownPeriodMinutes: doc.cooldownPeriodMinutes !== undefined ? doc.cooldownPeriodMinutes : 30,
            maxSectorAllocationPercent: doc.maxSectorAllocationPercent !== undefined ? doc.maxSectorAllocationPercent : 100,
            drawdownProtectionPercent: doc.drawdownProtectionPercent || 0,
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
