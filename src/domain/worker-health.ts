export interface WorkerHealth {
    workerName: string; // e.g. "TradeMonitor" or "StrategyAssistant"
    lastHeartbeat: Date;
    activeLoop: string;
    cycleTime: number;
    lastError?: string;
    updatedAt: Date;
}

export interface WorkerHealthRepository {
    upsertHealth(health: WorkerHealth): Promise<void>;
    findByName(name: string): Promise<WorkerHealth | null>;
}
