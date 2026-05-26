export interface AssistantMetrics {
    assistantId: string;
    totalTrades: number;
    wins: number;
    losses: number;
    totalPnL: number;
    activeHoldings?: any[];
    updatedAt: Date;
}

export interface AssistantMetricsRepository {
    upsertMetrics(metrics: AssistantMetrics): Promise<void>;
    findByAssistantId(assistantId: string): Promise<AssistantMetrics | null>;
    deleteByAssistantId(assistantId: string): Promise<void>;
}
