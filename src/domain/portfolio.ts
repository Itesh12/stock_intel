export interface Holding {
    id: string;
    symbol: string;
    quantity: number;
    averagePrice: number;
    currentPrice: number;
    marketValue: number;
    unrealizedPL: number;
    unrealizedPLPercent: number;
    dayChange?: number;
    dayChangePercent?: number;
    sector: string;
    weight: number; // Percentage of total portfolio
}

export interface Portfolio {
    id: string;
    userId: string;
    name: string;
    holdings: Holding[];
    totalValue: number;
    totalPL: number;
    totalPLPercent: number;
    dayPnL?: number;
    dayPnLPercent?: number;
    cashBalance: number;
    riskScore: number; // 0-100
    sectorExposure: Record<string, number>; // Sector -> Percentage
    updatedAt: Date;
    createdAt: Date;
}

export interface PortfolioStats {
    drawdown: number;
    volatility: number;
    sharpeRatio: number;
    beta: number;
    alpha: number;
}
