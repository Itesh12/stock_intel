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
        let score = 50; // Neutral starting point

        // 1. P/E Ratio (Lower is generally better, but not 0)
        if (stock.peRatio) {
            if (stock.peRatio < 15) score += 20;
            else if (stock.peRatio < 25) score += 10;
            else if (stock.peRatio > 50) score -= 10;
        }

        // 2. ROE (Higher is better)
        if (stock.roe) {
            const roePct = stock.roe * 100;
            if (roePct > 20) score += 20;
            else if (roePct > 10) score += 10;
            else if (roePct < 5) score -= 10;
        }

        // 3. Debt to Equity (Lower is safer)
        if (stock.debtToEquity) {
            if (stock.debtToEquity < 50) score += 10; // Debt/Equity < 0.5
            else if (stock.debtToEquity > 150) score -= 10;
        }

        // 4. Margins
        if (stock.profitMargins) {
            const margins = stock.profitMargins * 100;
            if (margins > 15) score += 10;
        }

        return Math.max(0, Math.min(100, score));
    }

    private computeTechnicalScore(stock: Stock, context: any): number {
        let score = 50;

        // 1. Price vs 52W Range (Trading near high is bullish)
        if (stock.fiftyTwoWeekHigh && stock.fiftyTwoWeekLow && stock.price) {
            const range = stock.fiftyTwoWeekHigh - stock.fiftyTwoWeekLow;
            const position = (stock.price - stock.fiftyTwoWeekLow) / (range || 1);
            
            if (position > 0.8) score += 20; // Near 52W High
            else if (position < 0.3) score -= 10; // Near 52W Low
        }

        // 2. Short term trend
        if (stock.changePercent > 1) score += 15;
        else if (stock.changePercent < -1) score -= 15;

        return Math.max(0, Math.min(100, score));
    }

    private computeLiquidityScore(stock: Stock): number {
        // Logarithmic scale for Market Cap + Volume proxy
        const capScore = Math.min((Math.log10(stock.marketCap || 1) - 6) * 10, 60); // 0-60 based on MCap
        const volumeScore = stock.volume && stock.volume > 1000000 ? 40 : 20; // +40 for high volume
        
        return Math.max(10, Math.min(100, capScore + volumeScore));
    }

    private computeRiskScore(stock: Stock, context: any): number {
        let score = 75; // Starting with "Safe" (Higher means better risk profile)

        // 1. Beta (Higher than 1.5 is risky)
        if (stock.beta) {
            if (stock.beta > 1.5) score -= 25;
            else if (stock.beta < 0.8) score += 10;
        }

        // 2. Debt exposure
        if (stock.debtToEquity && stock.debtToEquity > 100) {
            score -= 15;
        }

        // 3. Sector Volatility
        const highVolSectors = ["Technology", "Biotechnology", "Mining"];
        if (highVolSectors.includes(stock.sector)) {
            score -= 10;
        }

        return Math.max(0, Math.min(100, score));
    }

    private computeMomentumScore(stock: Stock): number {
        let score = 50;

        // Uses change percent as a proxy for momentum strength
        if (stock.changePercent > 3) score = 90;
        else if (stock.changePercent > 1) score = 75;
        else if (stock.changePercent < -3) score = 20;
        else if (stock.changePercent < -1) score = 40;

        return score;
    }
}
