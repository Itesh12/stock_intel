import { Stock } from "../domain/stock";

export interface MarketDataPort {
    getStockPrice(symbol: string): Promise<Partial<Stock>>;
    getHistoricalData(symbol: string, period: string, fromDate?: Date): Promise<any[]>;
    getPerformance(symbol: string, period: string): Promise<Partial<Stock> & {
        change: number;
        changePercent: number;
        currentPrice: number;
        low?: number;
        high?: number;
    }>;
    searchStocks(query: string): Promise<Partial<Stock>[]>;
    getScreenerData(scrId: string, count?: number): Promise<Partial<Stock>[]>;
    getNews(symbol: string, count?: number): Promise<any[]>;
}
