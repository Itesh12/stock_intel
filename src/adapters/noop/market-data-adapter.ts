import { MarketDataPort } from "../../ports/market-data-port";
import { Stock } from "../../domain/stock";

export class NoOpMarketAdapter implements MarketDataPort {
    async getStockPrice(symbol: string): Promise<Partial<Stock>> {
        return {
            symbol,
            price: 0,
            change: 0,
            changePercent: 0,
            lastUpdated: new Date()
        };
    }

    async getHistoricalData(symbol: string, period: string): Promise<any[]> {
        return [];
    }

    async getPerformance(symbol: string, period: string): Promise<{
        change: number;
        changePercent: number;
        currentPrice: number;
        volume?: number;
        symbol: string;
        low?: number;
        high?: number;
    }> {
        return {
            symbol,
            change: 0,
            changePercent: 0,
            currentPrice: 0
        };
    }

    async searchStocks(query: string): Promise<Partial<Stock>[]> {
        return [];
    }

    async getScreenerData(scrId: string, count: number = 25): Promise<Partial<Stock>[]> {
        return [];
    }
}
