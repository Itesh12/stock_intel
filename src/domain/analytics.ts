export interface PortfolioSnapshot {
    id: string;
    userId: string;
    nav: number;        // Net Asset Value (Cash + Holdings)
    cash: number;
    holdingsValue: number;
    timestamp: Date;
}

export interface AnalyticsRepository {
    saveSnapshot(snapshot: PortfolioSnapshot): Promise<void>;
    getSnapshots(userId: string, limit?: number): Promise<PortfolioSnapshot[]>;
    getLatestSnapshot(userId: string): Promise<PortfolioSnapshot | null>;
}
