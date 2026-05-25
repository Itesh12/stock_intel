export type AssistantStatus = 'DRAFT' | 'CONFIGURED' | 'RUNNING' | 'PAUSED' | 'RISK_STOPPED' | 'COMPLETED';

export interface StrategyAssistant {
    id: string;                         // UUID
    userId: string;                     // References user
    name: string;                       // Custom name
    strategySlug: string;               // e.g. 'canslim' | 'momentum' | 'swing' | 'buffett'
    strategyName: string;               // Display name
    status: AssistantStatus;
    mode: 'paper' | 'live';             // Execution sandbox mode
    
    // Sizing & Capital
    allocatedCapital: number;           // Total allocated INR budget
    deployedCapital: number;            // Current cash in active holdings
    maxPositionSizePercent: number;     // Sizing limit per trade
    
    // Risk & Exit Envelopes
    stopLossPercent: number;            // Exit SL
    takeProfitPercent: number;          // Exit TP
    useTrailingStop: boolean;           // Trailing SL trigger
    minConfluenceScore: number;         // Scanner score floor
    
    // Safety Circuit Breakers
    maxDailyLoss: number;               // Daily loss threshold (INR)
    maxConcurrentPositions: number;     // Active positions limit
    cooldownPeriodMinutes: number;      // Re-entry delay
    maxSectorAllocationPercent: number; // Exposure limit
    drawdownProtectionPercent: number;  // Peak drawdown threshold
    
    // Metrics Cache (Updated by Daemon)
    totalTradesExecuted: number;
    winCount: number;
    lossCount: number;
    totalPnL: number;
    todayTradeCount: number;
    todayDate: string;                  // "YYYY-MM-DD"
    createdAt: Date;
    updatedAt: Date;
}

export interface StrategyAssistantRepository {
    save(assistant: StrategyAssistant): Promise<void>;
    findById(id: string): Promise<StrategyAssistant | null>;
    findByUserId(userId: string): Promise<StrategyAssistant[]>;
    findAllRunning(): Promise<StrategyAssistant[]>;
    findRunningByStrategy(strategySlug: string): Promise<StrategyAssistant[]>;
    updateStats(id: string, stats: Partial<StrategyAssistant>, session?: any): Promise<void>;
    delete(id: string): Promise<void>;
}
