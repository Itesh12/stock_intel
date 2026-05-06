import { Stock } from "../domain/stock";
import { ScoringService } from "./scoring-service";
import { StockRepository } from "../ports/stock-repository";
import { Infrastructure } from "../infrastructure/container";

export interface IntelligenceMemo {
    symbol: string;
    name: string;
    overallScore: number;
    summary: string;
    keyMetrics: {
        valuation: "UNDERVALUED" | "FAIR_VALUED" | "OVERVALUED";
        momentum: "STRONG" | "NEUTRAL" | "WEAK";
        riskProfile: "CONSERVATIVE" | "MODERATE" | "AGGRESSIVE";
        sentiment: "BULLISH" | "BEARISH" | "NEUTRAL";
    };
    breakdown: {
        fundamental: number;
        technical: number;
        liquidity: number;
        risk: number;
        momentum: number;
    };
    recommendation: {
        action: "BUY" | "SELL" | "HOLD";
        rationale: string;
        confidence: number;
    };
    generatedAt: Date;
}

export class IntelligenceService {
    constructor(
        private infra: Infrastructure,
        private scoringService: ScoringService
    ) { }

    public async generateDeepDive(symbol: string): Promise<IntelligenceMemo | null> {
        let stock = await this.infra.stock.findBySymbol(symbol);
        
        // FIND-OR-FETCH: If missing from DB, fetch from Market Adapter and save
        if (!stock) {
            console.info(`[StockIntel] Intelligence cache miss for ${symbol}. Fetching from Market Adapter...`);
            const fetched = await this.infra.market.getStockPrice(symbol);
            
            if (!fetched || !fetched.name || fetched.price === 0) {
                return null;
            }

            // Map and Save to DB
            const newStock: Stock = {
                id: crypto.randomUUID(),
                symbol: fetched.symbol!,
                name: fetched.name!,
                sector: fetched.sector || 'General',
                marketCap: fetched.marketCap || 0,
                price: fetched.price || 0,
                change: fetched.change || 0,
                changePercent: fetched.changePercent || 0,
                lastUpdated: new Date(),
                createdAt: new Date(),
                ...fetched
            } as Stock;

            await this.infra.stock.save(newStock);
            stock = newStock;
        }

        const score = this.scoringService.calculateScore(stock, {});

        // Fetch and analyze news sentiment
        let sentiment: "BULLISH" | "BEARISH" | "NEUTRAL" = "NEUTRAL";
        try {
            const news = await this.infra.market.getNews(symbol, 5);
            let scoreCount = 0;
            const bullishKeywords = ['buy', 'growth', 'profit', 'surged', 'bullish', 'success', 'expand'];
            const bearishKeywords = ['sell', 'loss', 'drop', 'slashed', 'bearish', 'risk', 'fail'];

            news.forEach((item: any) => {
                const text = (item.title + " " + item.summary).toLowerCase();
                bullishKeywords.forEach(w => { if (text.includes(w)) scoreCount++; });
                bearishKeywords.forEach(w => { if (text.includes(w)) scoreCount--; });
            });

            if (scoreCount > 1) sentiment = "BULLISH";
            if (scoreCount < -1) sentiment = "BEARISH";
        } catch (err) {
            console.error("Sentiment analysis failed", err);
        }

        const valuation = score.fundamentalScore > 75 ? "UNDERVALUED" : (score.fundamentalScore < 40 ? "OVERVALUED" : "FAIR_VALUED");
        const momentum = score.momentumScore > 70 ? "STRONG" : (score.momentumScore < 30 ? "WEAK" : "NEUTRAL");
        const riskProfile = score.riskScore > 80 ? "CONSERVATIVE" : (score.riskScore < 45 ? "AGGRESSIVE" : "MODERATE");

        const action = score.overallScore > 75 ? "BUY" : (score.overallScore < 40 ? "SELL" : "HOLD");
        
        // 1. Calculate realistic Confidence
        // Factors: Data completeness + Score alignment
        const dataCompleteness = (stock.peRatio ? 0.2 : 0) + (stock.roe ? 0.2 : 0) + (stock.debtToEquity ? 0.2 : 0) + (stock.beta ? 0.2 : 0) + 0.2;
        const scoreDivergence = Math.abs(score.fundamentalScore - score.technicalScore) / 100;
        const confidenceScore = Math.round((dataCompleteness * 100 * (1 - scoreDivergence * 0.5)));

        // 2. Build dynamic Rationale
        let rational = "";
        const strengths = [];
        if (score.fundamentalScore > 70) strengths.push("robust fundamentals (ROE/margins)");
        if (score.technicalScore > 70) strengths.push("strong price action near 52W highs");
        if (score.momentumScore > 80) strengths.push("explosive short-term momentum");
        
        const risks = [];
        if (score.riskScore < 50) risks.push("elevated volatility/beta");
        if (score.fundamentalScore < 40) risks.push("stretched valuation (P/E)");

        if (action === "BUY") {
            rational = `${stock.symbol} is showing ${strengths.join(" and ")}. Sentiment is ${sentiment.toLowerCase()}.`;
        } else if (action === "SELL") {
            rational = `Caution advised due to ${risks.join(" and ")}. Technical momentum is ${momentum.toLowerCase()}.`;
        } else {
            rational = `Neutral stance. ${strengths.length > 0 ? strengths[0] : 'Stable metrics'} balanced by ${risks.length > 0 ? risks[0] : 'market uncertainty'}.`;
        }

        return {
            symbol: stock.symbol,
            name: stock.name,
            overallScore: score.overallScore,
            summary: `${stock.name} maintains a ${valuation.toLowerCase()} profile with ${momentum.toLowerCase()} momentum. Analysis confidence is ${confidenceScore}%.`,
            keyMetrics: {
                valuation,
                momentum,
                riskProfile,
                sentiment
            },
            breakdown: {
                fundamental: score.fundamentalScore,
                technical: score.technicalScore,
                liquidity: score.liquidityScore,
                risk: score.riskScore,
                momentum: score.momentumScore
            },
            recommendation: {
                action,
                rationale: rational,
                confidence: confidenceScore
            },
            generatedAt: new Date()
        };
    }
}
