export type BotStatus = 'ACTIVE' | 'PAUSED' | 'STOPPED';

export interface AutoTradeBot {
    id: string;
    userId: string;
    name: string;                       // User-defined bot name
    strategySlug: string;               // Matches strategy slug (canslim, swing-strategy, etc.)
    strategyName: string;               // Display name
    status: BotStatus;

    // Capital Rules
    capitalAllocated: number;           // Deprecated: Total INR budget (use allocatedCash)
    allocatedCash: number;              // Total INR budget for this bot
    deployedCash: number;               // Current cash deployed in open positions
    maxPositionSizePercent: number;     // Max % of capital per single trade
    riskPerTradePercent: number;        // Risk % per trade
    maxTradesPerDay: number;            // Hard cap

    // Advanced Risk Controls
    maxDailyLoss: number;               // Daily loss threshold (INR)
    maxConcurrentPositions: number;      // Position limit (Count)
    cooldownPeriodMinutes: number;       // Stop-out reentry pause duration
    maxSectorAllocationPercent: number;  // Sector exposure limit (Percentage)
    drawdownProtectionPercent: number;   // Dynamic peak-to-trough stop
    useTrailingStop: boolean;            // Enable/disable trailing SL

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
