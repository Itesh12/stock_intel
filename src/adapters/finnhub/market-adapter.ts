import { MarketDataPort } from "../../ports/market-data-port";
import { Stock } from "../../domain/stock";

export class FinnhubMarketAdapter implements MarketDataPort {
    private apiKey: string;
    private baseUrl = "https://finnhub.io/api/v1";

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    async getStockPrice(symbol: string): Promise<Partial<Stock>> {
        const response = await fetch(`${this.baseUrl}/quote?symbol=${symbol}&token=${this.apiKey}`);
        const data = await response.json();

        if (!data || data.c === undefined) {
            throw new Error(`Finnhub returned invalid data for ${symbol}`);
        }

        return {
            symbol,
            price: data.c,
            change: data.d,
            changePercent: data.dp,
            lastUpdated: new Date()
        };
    }

    async getHistoricalData(symbol: string, period: string): Promise<any[]> {
        // Basic implementation for daily candles
        // Period would be used to calculate 'from' and 'to'
        const to = Math.floor(Date.now() / 1000);
        const from = to - (30 * 24 * 60 * 60); // 30 days default

        const response = await fetch(
            `${this.baseUrl}/stock/candle?symbol=${symbol}Resolution=D&from=${from}&to=${to}&token=${this.apiKey}`
        );
        const data = await response.json();

        if (data.s !== "ok") return [];

        return data.c.map((price: number, i: number) => ({
            date: new Date(data.t[i] * 1000),
            close: price
        }));
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
        // Fallback to real-time price info for performance metrics in Finnhub
        const stock = await this.getStockPrice(symbol);
        return {
            symbol,
            change: stock.change || 0,
            changePercent: stock.changePercent || 0,
            currentPrice: stock.price || 0,
            volume: stock.volume
        };
    }

    async searchStocks(query: string): Promise<Partial<Stock>[]> {
        const response = await fetch(`${this.baseUrl}/search?q=${query}&token=${this.apiKey}`);
        const data = await response.json();

        if (!data.result) return [];

        return data.result.map((item: any) => ({
            symbol: item.symbol,
            name: item.description
        }));
    }

    async getScreenerData(scrId: string, count: number = 25): Promise<Partial<Stock>[]> {
        // Finnhub doesn't have a direct equivalent in the free tier
        // Return empty to satisfy interface for now
        return [];
    }
}
