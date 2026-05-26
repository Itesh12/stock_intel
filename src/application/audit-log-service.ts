import { Infrastructure } from "../infrastructure/container";
import { globalEvents } from "../infrastructure/events";
import { v4 as uuidv4 } from "uuid";

export class AuditLogService {
    constructor(private infra: Infrastructure) {}

    public async log(
        botId: string,
        level: "INFO" | "WARN" | "ERROR",
        category: "SCAN" | "TRADE_ENTRY" | "TRADE_EXIT" | "RISK_GUARD" | "SYSTEM",
        message: string,
        metadata?: any
    ): Promise<void> {
        try {
            await this.infra.assistantLog.save({
                id: uuidv4(),
                botId,
                timestamp: new Date(),
                level,
                category,
                message,
                metadata,
                createdAt: new Date()
            });
            globalEvents.emitLog(botId, level, category, message, metadata);
        } catch (err) {
            console.error("[AuditLogService] Failed to write audit log:", err);
        }
    }
}
