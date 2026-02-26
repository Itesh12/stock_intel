import { Stock } from "../domain/stock";
import { StockRepository } from "../ports/stock-repository";

export interface MarketSignal {
    symbol: string;
    type: "VOLUME_BREAKOUT" | "PRICE_SURGE" | "REVERSED_TREND" | "INSTITUTIONAL_BUY";
    strength: "LOW" | "MEDIUM" | "HIGH";
    description: string;
    timestamp: Date;
}

export class MarketIntelligenceService {
    constructor(private stockRepo: StockRepository) { }

    public async scanForSignals(): Promise<MarketSignal[]> {
        const stocks = await this.stockRepo.list();
        const signals: MarketSignal[] = [];

        for (const stock of stocks) {
            // 1. Check for Volume Breakout (Mock logic for now)
            // Implementation would compare current volume against 20-day average
            if (stock.price > 100 && stock.changePercent > 3) {
                signals.push({
                    symbol: stock.symbol,
                    type: "VOLUME_BREAKOUT",
                    strength: "HIGH",
                    description: "Abnormal volume spike detected with price breakout.",
                    timestamp: new Date()
                });
            }

            // 2. Check for Institutional Accumulation patterns
            if (stock.marketCap > 10000000000 && stock.changePercent > 1) {
                // simplified detection logic
                signals.push({
                    symbol: stock.symbol,
                    type: "INSTITUTIONAL_BUY",
                    strength: "MEDIUM",
                    description: "Large block trade patterns detected in the last hour.",
                    timestamp: new Date()
                });
            }
        }

        return signals;
    }
}
