import { Db, Collection } from "mongodb";

export interface JournalEntry {
    id: string;
    userId: string;
    symbol?: string; // Optional: associate note with a specific stock
    content: string;
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
}

export class MongoJournalRepository {
    private collection: Collection<JournalEntry>;

    constructor(db: Db) {
        this.collection = db.collection<JournalEntry>("journals");
    }

    async findByUserId(userId: string): Promise<JournalEntry[]> {
        return await this.collection.find({ userId } as any).sort({ createdAt: -1 }).toArray();
    }

    async save(entry: JournalEntry): Promise<void> {
        await this.collection.updateOne(
            { id: entry.id } as any,
            { $set: entry },
            { upsert: true }
        );
    }

    async delete(id: string, userId: string): Promise<void> {
        await this.collection.deleteOne({ id, userId } as any);
    }
}
