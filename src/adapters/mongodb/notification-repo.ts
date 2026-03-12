import { Db, Collection } from "mongodb";
import { Notification, NotificationRepository } from "../../ports/notification-repository";

export class MongoNotificationRepository implements NotificationRepository {
    private collection: Collection<Notification>;

    constructor(db: Db) {
        this.collection = db.collection<Notification>("notifications");
    }

    async findByUserId(userId: string, limit: number = 20): Promise<Notification[]> {
        return await this.collection
            .find({ userId } as any)
            .sort({ timestamp: -1 })
            .limit(limit)
            .toArray();
    }

    async save(notification: Notification): Promise<void> {
        await this.collection.updateOne(
            { id: notification.id } as any,
            { $set: notification },
            { upsert: true }
        );
    }

    async markAsRead(id: string, userId: string): Promise<void> {
        await this.collection.updateOne(
            { id, userId } as any,
            { $set: { read: true } }
        );
    }

    async markAllAsRead(userId: string): Promise<void> {
        await this.collection.updateMany(
            { userId, read: false } as any,
            { $set: { read: true } }
        );
    }
}
