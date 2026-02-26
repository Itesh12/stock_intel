import { MarketSignal } from "./market-intelligence";

export interface Notification {
    id: string;
    title: string;
    message: string;
    type: "SIGNAL" | "SYSTEM" | "PORTFOLIO";
    severity: "INFO" | "WARNING" | "CRITICAL";
    timestamp: Date;
    read: boolean;
}

export class NotificationService {
    private notifications: Notification[] = [];

    public notifySignal(signal: MarketSignal) {
        const notification: Notification = {
            id: Math.random().toString(36).substr(2, 9),
            title: `${signal.type}: ${signal.symbol}`,
            message: signal.description,
            type: "SIGNAL",
            severity: signal.strength === "HIGH" ? "CRITICAL" : "INFO",
            timestamp: new Date(),
            read: false
        };

        this.notifications.unshift(notification);
        console.log(`[Notification] ${notification.title}: ${notification.message}`);
    }

    public getUnread(): Notification[] {
        return this.notifications.filter(n => !n.read);
    }

    public markAsRead(id: string) {
        const n = this.notifications.find(notif => notif.id === id);
        if (n) n.read = true;
    }
}
