export type BotStatus = 'ACTIVE' | 'PAUSED' | 'STOPPED';

export interface AutoTradeBot {
    id: string;
    userId: string;
    name: string;                       // User-defined bot name
    strategySlug: string;               // Matches strategy slug (canslim, swing-strategy, etc.)
    strategyName: string;               // Display name
    status: BotStatus;

    // Capital Rules
    capitalAllocated: number;           // Total INR budget for this bot
    maxPositionSizePercent: number;     // Max % of capital per single trade (5-30)
    riskPerTradePercent: number;        // Risk % per trade (1-5)
    maxTradesPerDay: number;            // Hard cap

    // Exit Rules
    stopLossPercent: number;            // Auto SL in % below entry
    takeProfitPercent: number;          // Auto TP in % above entry

    // Signal Filter
    minConfluenceScore: number;         // Minimum scanner score (0-100)

    // Live Stats (updated by daemon)
    totalTradesExecuted: number;
    winCount: number;
    lossCount: number;
    totalPnL: number;
    todayTradeCount: number;
    todayDate: string;                  // "YYYY-MM-DD" for daily reset

    createdAt: Date;
    updatedAt: Date;
}

export interface AutoTradeBotRepository {
    save(bot: AutoTradeBot): Promise<void>;
    findById(id: string): Promise<AutoTradeBot | null>;
    findByUserId(userId: string): Promise<AutoTradeBot[]>;
    findAllActive(): Promise<AutoTradeBot[]>;
    updateStats(id: string, stats: Partial<AutoTradeBot>, session?: any): Promise<void>;
    delete(id: string): Promise<void>;
}
