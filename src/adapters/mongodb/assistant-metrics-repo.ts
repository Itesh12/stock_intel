import { Collection, Db } from "mongodb";
import { AssistantMetrics, AssistantMetricsRepository } from "../../domain/assistant-metrics";

export class MongoAssistantMetricsRepository implements AssistantMetricsRepository {
    private collection: Collection<AssistantMetrics>;

    constructor(db: Db) {
        this.collection = db.collection<AssistantMetrics>("assistant_metrics");
        this.collection.createIndex({ assistantId: 1 }, { unique: true }).catch(err => {
            console.error("[MongoAssistantMetricsRepository] Failed to create unique index on assistantId:", err);
        });
    }

    async upsertMetrics(metrics: AssistantMetrics): Promise<void> {
        const updateDoc: any = {
            $set: {
                totalTrades: metrics.totalTrades,
                wins: metrics.wins,
                losses: metrics.losses,
                totalPnL: metrics.totalPnL,
                updatedAt: metrics.updatedAt
            }
        };

        if (metrics.activeHoldings !== undefined) {
            updateDoc.$set.activeHoldings = metrics.activeHoldings;
        }

        await this.collection.updateOne(
            { assistantId: metrics.assistantId },
            updateDoc,
            { upsert: true }
        );
    }

    async findByAssistantId(assistantId: string): Promise<AssistantMetrics | null> {
        const doc = await this.collection.findOne({ assistantId });
        if (!doc) return null;
        return {
            assistantId: doc.assistantId,
            totalTrades: doc.totalTrades,
            wins: doc.wins,
            losses: doc.losses,
            totalPnL: doc.totalPnL,
            activeHoldings: doc.activeHoldings,
            updatedAt: doc.updatedAt
        };
    }

    async deleteByAssistantId(assistantId: string): Promise<void> {
        await this.collection.deleteOne({ assistantId });
    }
}
