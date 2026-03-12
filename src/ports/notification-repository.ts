export interface Notification {
    id: string;
    userId: string;
    title: string;
    message: string;
    type: "SIGNAL" | "SYSTEM" | "PORTFOLIO";
    severity: "INFO" | "WARNING" | "CRITICAL";
    timestamp: Date;
    read: boolean;
}

export interface NotificationRepository {
    findByUserId(userId: string, limit?: number): Promise<Notification[]>;
    save(notification: Notification): Promise<void>;
    markAsRead(id: string, userId: string): Promise<void>;
    markAllAsRead(userId: string): Promise<void>;
}
