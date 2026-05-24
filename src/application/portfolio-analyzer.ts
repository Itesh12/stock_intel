import { Portfolio, Holding } from "../domain/portfolio";
import { StockRepository } from "../ports/stock-repository";
import { NotificationService } from "./notification-service";
import { NotificationRepository } from "../ports/notification-repository";
import { TradeRepository } from "../ports/trade-repository";
import { Trade } from "../domain/trade";
import { MarketDataPort } from "../ports/market-data-port";

export class PortfolioAnalyzer {
    private notificationService: NotificationService;

    constructor(
        private stockRepo: StockRepository,
        private notificationRepo: NotificationRepository,
        private tradeRepo: TradeRepository,
        private marketData: MarketDataPort
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
            try {
                const stock = await this.marketData.getStockPrice(holding.symbol);
                if (stock.price && stock.price > 0) {
                    holding.currentPrice = stock.price;
                }
            } catch (err) {
                console.warn(`Real-time price fetch failed for ${holding.symbol}:`, err);
            }

            holding.marketValue = holding.quantity * holding.currentPrice;
            holding.unrealizedPL = holding.marketValue - (holding.quantity * holding.averagePrice);
            holding.unrealizedPLPercent = (holding.quantity * holding.averagePrice) > 0 
                ? (holding.unrealizedPL / (holding.quantity * holding.averagePrice)) * 100 
                : 0;

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

        const INITIAL_BALANCE = 1000000;
        const currentEquity = totalValue + (portfolio.cashBalance || 0);
        const totalPLPercent = ((currentEquity - INITIAL_BALANCE) / INITIAL_BALANCE) * 100;
        const absolutePL = currentEquity - INITIAL_BALANCE;
        const finalRiskScore = Math.min(riskScore, 100);

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

        // 6. Generate Performance History (30-day Trajectory)
        const performanceHistory: { date: string, nav: number }[] = [];
        try {
            if (holdings.length > 0) {
                const dateMap: Record<string, number> = {};
                
                // Fetch in parallel but handle errors per-symbol
                await Promise.all(holdings.map(async (h) => {
                    try {
                        const history = await this.marketData.getHistoricalData(h.symbol, '1mo');
                        if (history && history.length > 0) {
                            history.forEach((point: any) => {
                                const date = new Date(point.date).toISOString().split('T')[0];
                                dateMap[date] = (dateMap[date] || portfolio.cashBalance || 0) + ((point.close || point.price || 0) * h.quantity);
                            });
                        }
                    } catch (err) {
                        console.warn(`Failed to fetch history for ${h.symbol}:`, err);
                    }
                }));
                
                Object.entries(dateMap).forEach(([date, nav]) => {
                    performanceHistory.push({ date, nav });
                });
                
                performanceHistory.sort((a, b) => a.date.localeCompare(b.date));
                
                // Final Synchronization Pass: 
                // Ensure the VERY LAST point precisely matches the total live value (Header Sync)
                if (performanceHistory.length > 0) {
                    const today = new Date().toISOString().split('T')[0];
                    const lastIdx = performanceHistory.length - 1;
                    const lastPoint = performanceHistory[lastIdx];
                    
                    // If the last point is today, override it with the live total value
                    // If it's not today, add today with the live total value
                    if (lastPoint.date === today) {
                        performanceHistory[lastIdx].nav = totalValue + (portfolio.cashBalance || 0);
                    } else {
                        performanceHistory.push({ date: today, nav: totalValue + (portfolio.cashBalance || 0) });
                    }
                }
                
                // Final Check: If we have zero or one point but have holdings, ensure we have a baseline
                if (performanceHistory.length < 2 && performanceHistory.length > 0) {
                    const existing = performanceHistory[0];
                    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
                    if (existing.date === new Date().toISOString().split('T')[0]) {
                        performanceHistory.unshift({ date: yesterday, nav: existing.nav });
                    }
                }
            }
        } catch (err) {
            console.error("Error generating performance history:", err);
        }

        return {
            ...portfolio,
            holdings,
            totalValue: currentEquity,
            totalPL: absolutePL,
            totalPLPercent,
            sectorExposure,
            riskScore: finalRiskScore,
            performanceHistory,
            updatedAt: new Date(),
        };
    }

    async generateAnalytics(portfolio: any): Promise<any> {
        try {
            if (!portfolio || !portfolio.userId) {
                return { sharpeRatio: 0, maxDrawdown: 0, volatility: 0, history: [] };
            }

            const { getInfrastructure } = require("@/infrastructure/container");
            const infra = await getInfrastructure();
            const userId = portfolio.userId;

            // Fetch snapshots for the last 30 days
            const snapshots = await infra.analytics.getSnapshots(userId, 31);

            if (snapshots.length < 2) {
                return {
                    sharpeRatio: 0,
                    maxDrawdown: 0,
                    volatility: 0,
                    history: snapshots
                };
            }

            // Calculate Daily Returns
            const returns: number[] = [];
            for (let i = 0; i < snapshots.length - 1; i++) {
                const current = snapshots[i].nav;
                const previous = snapshots[i + 1].nav;
                if (previous > 0) {
                    returns.push((current - previous) / previous);
                }
            }

            // 1. Volatility (Standard Deviation of Daily Returns)
            const meanReturn = returns.reduce((a: number, b: number) => a + b, 0) / returns.length;
            const variance = returns.reduce((a: number, b: number) => a + Math.pow(b - meanReturn, 2), 0) / returns.length;
            const dailyVol = Math.sqrt(variance);
            const annualizedVol = dailyVol * Math.sqrt(252); // Annualizing daily vol

            // 2. Sharpe Ratio (Assuming Risk-Free Rate = 0 for simplicity)
            const annualizedReturn = meanReturn * 252;
            const sharpeRatio = annualizedVol > 0 ? annualizedReturn / annualizedVol : 0;

            // 3. Max Drawdown
            let maxNav = 0;
            let maxDd = 0;

            // Snapshots are sorted by timestamp DESC, so we iterate from end (oldest) to start (newest)
            const chronSnapshots = [...snapshots].reverse();
            for (const snap of chronSnapshots) {
                if (snap.nav > maxNav) {
                    maxNav = snap.nav;
                }
                const dd = maxNav > 0 ? (maxNav - snap.nav) / maxNav : 0;
                if (dd > maxDd) {
                    maxDd = dd;
                }
            }

            return {
                sharpeRatio: Number(sharpeRatio.toFixed(2)),
                maxDrawdown: Number((maxDd * 100).toFixed(2)),
                volatility: Number((annualizedVol * 100).toFixed(2)),
                history: snapshots
            };
        } catch (error: any) {
            console.warn(`[StockIntel] Error generating analytics: ${error.message || error}`);
            return {
                sharpeRatio: 0,
                maxDrawdown: 0,
                volatility: 0,
                history: []
            };
        }
    }
}
