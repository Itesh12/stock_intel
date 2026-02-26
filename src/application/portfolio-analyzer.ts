import { Portfolio, Holding } from "../domain/portfolio";
import { StockRepository } from "../ports/stock-repository";

export class PortfolioAnalyzer {
    constructor(private stockRepo: StockRepository) { }

    async analyze(portfolio: Portfolio): Promise<Portfolio> {
        const holdings = [...portfolio.holdings];
        let totalValue = 0;
        let totalPL = 0;
        const sectorExposure: Record<string, number> = {};

        // 1. Update each holding with current prices and compute values
        for (const holding of holdings) {
            const stock = await this.stockRepo.findBySymbol(holding.symbol);
            if (stock) {
                holding.currentPrice = stock.price;
                holding.sector = stock.sector;
            }

            holding.marketValue = holding.quantity * holding.currentPrice;
            holding.unrealizedPL = holding.marketValue - (holding.quantity * holding.averagePrice);
            holding.unrealizedPLPercent = (holding.unrealizedPL / (holding.quantity * holding.averagePrice)) * 100;

            totalValue += holding.marketValue;
            totalPL += holding.unrealizedPL;
        }

        // 2. Compute weights and sector exposure
        if (totalValue > 0) {
            for (const holding of holdings) {
                holding.weight = (holding.marketValue / totalValue) * 100;
                sectorExposure[holding.sector] = (sectorExposure[holding.sector] || 0) + holding.weight;
            }
        }

        // 3. Compute overall risk score (Simplified logic for now)
        // Higher concentration in a single sector increases risk
        const maxSectorExp = Math.max(...Object.values(sectorExposure), 0);
        let riskScore = 20; // Base risk
        if (maxSectorExp > 40) riskScore += 30; // High concentration risk
        if (maxSectorExp > 60) riskScore += 30; // Very high concentration risk

        return {
            ...portfolio,
            holdings,
            totalValue,
            totalPL,
            totalPLPercent: totalValue > 0 ? (totalPL / (totalValue - totalPL)) * 100 : 0,
            sectorExposure,
            riskScore: Math.min(riskScore, 100),
            updatedAt: new Date(),
        };
    }
}
