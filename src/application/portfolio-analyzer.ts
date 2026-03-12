import { Portfolio, Holding } from "../domain/portfolio";
import { StockRepository } from "../ports/stock-repository";
import { NotificationService } from "./notification-service";
import { NotificationRepository } from "../ports/notification-repository";
import { TradeRepository } from "../ports/trade-repository";
import { Trade } from "../domain/trade";

export class PortfolioAnalyzer {
    private notificationService: NotificationService;

    constructor(
        private stockRepo: StockRepository,
        private notificationRepo: NotificationRepository,
        private tradeRepo: TradeRepository
    ) { 
        this.notificationService = new NotificationService(this.notificationRepo);
    }

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
        const maxSectorExp = Math.max(...Object.values(sectorExposure), 0);
        let riskScore = 20; // Base risk
        if (maxSectorExp > 40) riskScore += 30; // High concentration risk
        if (maxSectorExp > 60) riskScore += 30; // Very high concentration risk

        const finalRiskScore = Math.min(riskScore, 100);
        const totalPLPercent = totalValue > 0 ? (totalPL / (totalValue - totalPL)) * 100 : 0;

        // 4. Trigger Health Notifications
        if (portfolio.userId) {
            if (finalRiskScore >= 80) {
                await this.notificationService.notifyPortfolio(
                    portfolio.userId,
                    "High Concentration Risk",
                    `Your portfolio has a high risk score of ${finalRiskScore}. Consider diversifying across more sectors.`,
                    "CRITICAL"
                );
            }

            if (totalPLPercent <= -10) {
                await this.notificationService.notifyPortfolio(
                    portfolio.userId,
                    "Significant Portfolio Drawdown",
                    `Your portfolio is down ${totalPLPercent.toFixed(2)}%. Review your holdings for potential exits.`,
                    "CRITICAL"
                );
            }
        }

        // 5. Calculate Institutional Metrics
        if (portfolio.userId) {
            const trades = await this.tradeRepo.findByUserId(portfolio.userId);
            if (trades.length > 0) {
                const sellTrades = trades.filter(t => t.type === 'SELL');
                // Note: Simplified logic - assumes last in first out or matching symbols
                // For a true profit factor, we need a realized p/l ledger. 
                // Using a heuristic based on trade price vs average cost would be better but requires more state.
                // For now, let's use the trades to get Win/Loss and generic metrics.
                
                const winners = sellTrades.filter(t => t.price > 0); // Simplified: check if sell price > 0 for now
                // Real implementation would track buy price per unit
                
                // Let's implement active metrics calculation
                let totalProfit = 0;
                let totalLoss = 0;
                let wins = 0;
                let losses = 0;

                // Heuristic calculation
                sellTrades.forEach(trade => {
                    // Logic to find matching buy average would go here
                    // For now we use the portfolio average if available
                    const holding = portfolio.holdings.find(h => h.symbol === trade.symbol);
                    if (holding) {
                        const pl = (trade.price - holding.averagePrice) * trade.quantity;
                        if (pl > 0) {
                            totalProfit += pl;
                            wins++;
                        } else {
                            totalLoss += Math.abs(pl);
                            losses++;
                        }
                    }
                });

                portfolio.profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? 5 : 0;
                portfolio.winRate = (wins + losses) > 0 ? (wins / (wins + losses)) * 100 : 0;
                portfolio.avgWin = wins > 0 ? totalProfit / wins : 0;
                portfolio.avgLoss = losses > 0 ? totalLoss / losses : 0;
            }
        }

        return {
            ...portfolio,
            holdings,
            totalValue,
            totalPL,
            totalPLPercent,
            sectorExposure,
            riskScore: finalRiskScore,
            updatedAt: new Date(),
        };
    }
}
