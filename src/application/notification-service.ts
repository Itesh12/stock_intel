import { MarketSignal } from "./market-intelligence";
import { Notification, NotificationRepository } from "../ports/notification-repository";
import { v4 as uuidv4 } from "uuid";

export class NotificationService {
    constructor(private notificationRepo: NotificationRepository) { }

    public async notifySignal(userId: string, signal: MarketSignal) {
        const notification: Notification = {
            id: uuidv4(),
            userId,
            title: `${signal.type.replace(/_/g, ' ')}: ${signal.symbol}`,
            message: signal.description,
            type: "SIGNAL",
            severity: signal.strength === "HIGH" ? "CRITICAL" : "INFO",
            timestamp: new Date(),
            read: false
        };

        await this.notificationRepo.save(notification);
        console.log(`[Notification] ${notification.title}: ${notification.message}`);
    }

    public async notifySystem(userId: string, title: string, message: string, severity: "INFO" | "WARNING" | "CRITICAL" = "INFO") {
        const notification: Notification = {
            id: uuidv4(),
            userId,
            title,
            message,
            type: "SYSTEM",
            severity,
            timestamp: new Date(),
            read: false
        };

        await this.notificationRepo.save(notification);
    }

    public async notifyPortfolio(userId: string, title: string, message: string, severity: "INFO" | "WARNING" | "CRITICAL" = "WARNING") {
        const notification: Notification = {
            id: uuidv4(),
            userId,
            title,
            message,
            type: "PORTFOLIO",
            severity,
            timestamp: new Date(),
            read: false
        };

        await this.notificationRepo.save(notification);
    }

    public async getForUser(userId: string, limit: number = 20): Promise<Notification[]> {
        return await this.notificationRepo.findByUserId(userId, limit);
    }

    public async markRead(id: string, userId: string) {
        await this.notificationRepo.markAsRead(id, userId);
    }

    public async markAllRead(userId: string) {
        await this.notificationRepo.markAllAsRead(userId);
    }
}
