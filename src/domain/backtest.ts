export interface BacktestTrade {
    id: string;
    symbol: string;
    type: 'BUY' | 'SELL';
    quantity: number;
    price: number;
    timestamp: Date;
    totalValue: number;
    reason?: string;
}

export interface BacktestSnapshot {
    timestamp: Date;
    nav: number;
    cash: number;
    holdingsValue: number;
    unrealizedPL: number;
}

export interface BacktestResult {
    id: string;
    userId: string;
    symbol: string;
    strategyName: string;
    startDate: Date;
    endDate: Date;
    initialCapital: number;
    finalNav: number;
    totalReturn: number;
    totalReturnPercent: number;
    maxDrawdown: number;
    winRate: number;
    profitFactor: number;
    trades: BacktestTrade[];
    equityCurve: BacktestSnapshot[];
}
