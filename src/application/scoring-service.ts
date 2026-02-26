import { Stock, StockScore } from "../domain/stock";

export class ScoringService {
    /**
     * Weights defined in the product requirement:
     * Factor                   Weight
     * Fundamental Strength     30%
     * Technical Trend          25%
     * Liquidity                15%
     * Risk                     15%
     * Momentum                 15%
     */
    private readonly weights = {
        fundamental: 0.30,
        technical: 0.25,
        liquidity: 0.15,
        risk: 0.15,
        momentum: 0.15
    };

    public calculateScore(stock: Stock, marketContext: any): StockScore {
        // 1. Compute individual component scores (0-100)
        const fundamentalScore = this.computeFundamentalScore(stock);
        const technicalScore = this.computeTechnicalScore(stock, marketContext);
        const liquidityScore = this.computeLiquidityScore(stock);
        const riskScore = this.computeRiskScore(stock, marketContext);
        const momentumScore = this.computeMomentumScore(stock);

        // 2. Compute weighted overall score
        const overallScore =
            (fundamentalScore * this.weights.fundamental) +
            (technicalScore * this.weights.technical) +
            (liquidityScore * this.weights.liquidity) +
            (riskScore * this.weights.risk) +
            (momentumScore * this.weights.momentum);

        return {
            stockId: stock.id,
            overallScore: Math.round(overallScore),
            fundamentalScore: Math.round(fundamentalScore),
            technicalScore: Math.round(technicalScore),
            liquidityScore: Math.round(liquidityScore),
            riskScore: Math.round(riskScore),
            momentumScore: Math.round(momentumScore),
            updatedAt: new Date()
        };
    }

    private computeFundamentalScore(stock: Stock): number {
        // Placeholder logic for Phase 1/2
        // In production, this would look at P/E, Debt/Equity, Revenue Growth etc.
        if (stock.marketCap > 2000000000000) return 85; // Mega caps
        if (stock.marketCap > 100000000000) return 75; // Large caps
        return 60;
    }

    private computeTechnicalScore(stock: Stock, context: any): number {
        // Looks at EMA/SMA crossovers, RSI etc.
        const change = stock.changePercent;
        if (change > 2) return 90;
        if (change > 0) return 70;
        if (change > -2) return 50;
        return 30;
    }

    private computeLiquidityScore(stock: Stock): number {
        // High market cap usually implies high liquidity
        return Math.min(stock.marketCap / 1000000000, 100);
    }

    private computeRiskScore(stock: Stock, context: any): number {
        // Beta, Volatility, Sector risk
        if (stock.sector === "Technology") return 65; // High vol
        if (stock.sector === "Utilities") return 85; // Low risk (higher score here means better/lower risk)
        return 75;
    }

    private computeMomentumScore(stock: Stock): number {
        // Recent price performance
        return stock.changePercent > 0 ? 80 : 40;
    }
}
