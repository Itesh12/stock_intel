import { Collection, Db } from "mongodb";
import { WorkerHealth, WorkerHealthRepository } from "../../domain/worker-health";

export class MongoWorkerHealthRepository implements WorkerHealthRepository {
    private collection: Collection<WorkerHealth>;

    constructor(db: Db) {
        this.collection = db.collection<WorkerHealth>("worker_health");
        this.collection.createIndex({ workerName: 1 }, { unique: true }).catch(err => {
            console.error("[MongoWorkerHealthRepository] Failed to create unique index on workerName:", err);
        });
    }

    async upsertHealth(health: WorkerHealth): Promise<void> {
        const updateDoc: any = {
            $set: {
                lastHeartbeat: health.lastHeartbeat,
                activeLoop: health.activeLoop,
                cycleTime: health.cycleTime,
                updatedAt: health.updatedAt
            }
        };

        if (health.lastError !== undefined) {
            updateDoc.$set.lastError = health.lastError;
        } else {
            updateDoc.$unset = { lastError: "" };
        }

        await this.collection.updateOne(
            { workerName: health.workerName },
            updateDoc,
            { upsert: true }
        );
    }

    async findByName(workerName: string): Promise<WorkerHealth | null> {
        const doc = await this.collection.findOne({ workerName });
        if (!doc) return null;
        return {
            workerName: doc.workerName,
            lastHeartbeat: doc.lastHeartbeat,
            activeLoop: doc.activeLoop,
            cycleTime: doc.cycleTime,
            lastError: doc.lastError,
            updatedAt: doc.updatedAt
        };
    }
}
