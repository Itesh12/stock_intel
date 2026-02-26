import { Stock } from "../domain/stock";

export interface MarketDataPort {
    getStockPrice(symbol: string): Promise<Partial<Stock>>;
    getHistoricalData(symbol: string, period: string, fromDate?: Date): Promise<any[]>;
    getPerformance(symbol: string, period: string): Promise<{
        change: number;
        changePercent: number;
        currentPrice: number;
        volume?: number;
        symbol: string;
        low?: number;
        high?: number;
        sector?: string | null;
    }>;
    searchStocks(query: string): Promise<Partial<Stock>[]>;
    getScreenerData(scrId: string, count?: number): Promise<Partial<Stock>[]>;
}
