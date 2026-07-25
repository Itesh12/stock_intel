import { Stock } from "../domain/stock";
import { StockRepository } from "../ports/stock-repository";

export interface MarketSignal {
    symbol: string;
    type: "VOLUME_BREAKOUT" | "PRICE_SURGE" | "REVERSED_TREND" | "INSTITUTIONAL_BUY" | "ORDER_EXECUTED" | "ORDER_FAILED";
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
            // 1. Check for Volume Breakout / Price Surge
            if (stock.changePercent && stock.changePercent >= 2.5) {
                const isHighVolume = stock.volume && stock.volume > 50000;
                signals.push({
                    symbol: stock.symbol,
                    type: isHighVolume ? "VOLUME_BREAKOUT" : "PRICE_SURGE",
                    strength: stock.changePercent >= 4.0 ? "HIGH" : "MEDIUM",
                    description: `Price momentum surge of +${stock.changePercent.toFixed(2)}% detected in session.${isHighVolume ? ' High volume activity confirmed.' : ''}`,
                    timestamp: new Date()
                });
            }

            // 2. Check for Institutional Accumulation patterns on large caps
            if (stock.marketCap && stock.marketCap > 100000000000 && stock.changePercent && stock.changePercent >= 1.0) {
                signals.push({
                    symbol: stock.symbol,
                    type: "INSTITUTIONAL_BUY",
                    strength: stock.marketCap > 500000000000 ? "HIGH" : "MEDIUM",
                    description: `Large-cap accumulation detected for ${stock.name || stock.symbol} with +${stock.changePercent.toFixed(2)}% upside.`,
                    timestamp: new Date()
                });
            }
        }

        return signals;
    }
}
