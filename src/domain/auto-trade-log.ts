export interface AutoTradeLog {
    id: string;
    botId: string;
    timestamp: Date;
    level: 'INFO' | 'WARN' | 'ERROR';
    category: 'SCAN' | 'TRADE_ENTRY' | 'TRADE_EXIT' | 'RISK_GUARD' | 'SYSTEM';
    message: string;
    metadata?: any;
    createdAt: Date; // Used by MongoDB TTL Index
}

export interface AutoTradeLogRepository {
    save(log: AutoTradeLog): Promise<void>;
    findByBotId(botId: string, limit?: number): Promise<AutoTradeLog[]>;
    deleteByBotId(botId: string): Promise<void>;
}
