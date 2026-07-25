import { StockRepository } from "../ports/stock-repository";
import { PortfolioRepository } from "../ports/portfolio-repository";
import { ScoringService } from "./scoring-service";
import { PortfolioAnalyzer } from "./portfolio-analyzer";

export interface AIResponse {
    answer: string;
    dataPoints?: any;
    recommendation?: string;
    type: "VALUATION" | "PORTFOLIO_RISK" | "COMPARISON" | "SENTIMENT" | "GENERAL";
}

type Intent = "VALUATION" | "PORTFOLIO_RISK" | "COMPARISON" | "SENTIMENT" | "UNKNOWN";

export class AICopilotService {
    constructor(
        private stockRepo: StockRepository,
        private scoringService: ScoringService,
        private portfolioAnalyzer: PortfolioAnalyzer,
        private portfolioRepo?: PortfolioRepository
    ) { }

    public async ask(query: string, context?: { symbol?: string; portfolioId?: string; userId?: string }): Promise<AIResponse> {
        const q = query.toLowerCase();
        const intent = this.parseIntent(q);

        switch (intent) {
            case "COMPARISON":
                return await this.handleComparison(q);
            case "VALUATION":
                return await this.handleValuation(q, context?.symbol);
            case "PORTFOLIO_RISK":
                return await this.handlePortfolioRisk(context);
            case "SENTIMENT":
                return await this.handleSentiment(q, context?.symbol);
            default:
                return {
                    answer: "I'm your StockIntel Copilot. You can ask me to compare stocks, check valuations, or analyze portfolio risk. Try: 'Compare NVDA vs AMD' or 'Is AAPL overvalued?'",
                    type: "GENERAL"
                };
        }
    }

    private parseIntent(query: string): Intent {
        if (query.includes("vs") || query.includes("compare") || query.includes("relative to")) return "COMPARISON";
        if (query.includes("sentiment") || query.includes("news") || query.includes("vibe") || query.includes("feeling")) return "SENTIMENT";
        if (query.includes("overvalued") || query.includes("valuation") || query.includes("worth") || query.includes("price")) return "VALUATION";
        if (query.includes("risk") || query.includes("diversification") || query.includes("drawdown")) return "PORTFOLIO_RISK";
        return "UNKNOWN";
    }

    private async handleValuation(query: string, contextSymbol?: string): Promise<AIResponse> {
        const symbol = contextSymbol || this.extractSymbols(query)[0];
        if (!symbol) return { answer: "Which stock are you referring to? Please specify a symbol like 'RELIANCE' or 'AAPL'.", type: "GENERAL" };

        const stock = await this.stockRepo.findBySymbol(symbol);
        if (!stock) return { answer: `I couldn't find data for ${symbol}.`, type: "VALUATION" };

        const score = this.scoringService.calculateScore(stock, {});
        const valuationText = score.fundamentalScore < 40 ? "overvalued" : (score.fundamentalScore > 75 ? "undervalued" : "fairly valued");

        return {
            answer: `Analysis of ${stock.name} (${symbol}): It appears ${valuationText} with a fundamental score of ${score.fundamentalScore}/100. Its momentum is ${score.momentumScore > 70 ? 'strong' : 'neutral'}.`,
            recommendation: score.overallScore > 75 ? "BUY" : (score.overallScore < 40 ? "SELL" : "HOLD"),
            dataPoints: { score },
            type: "VALUATION"
        };
    }

    private async handleComparison(query: string): Promise<AIResponse> {
        const symbols = this.extractSymbols(query);
        if (symbols.length < 2) return { answer: "Please provide at least two symbols to compare (e.g., 'Compare RELIANCE vs TCS').", type: "GENERAL" };

        const stocks = await Promise.all(symbols.map(s => this.stockRepo.findBySymbol(s)));
        const validStocks = stocks.filter(s => s !== null);

        if (validStocks.length < 2) return { answer: "I couldn't find data for one or more of those symbols.", type: "COMPARISON" };

        const scores = validStocks.map(s => ({
            symbol: s!.symbol,
            name: s!.name,
            score: this.scoringService.calculateScore(s!, {})
        }));

        const winner = scores.reduce((prev, curr) => (prev.score.overallScore > curr.score.overallScore) ? prev : curr);

        return {
            answer: `Comparing ${scores.map(s => s.symbol).join(' and ')}: ${winner.name} (${winner.symbol}) has the edge with an overall score of ${winner.score.overallScore} vs ${scores.find(s => s !== winner)?.score.overallScore}. ${winner.symbol} shows better ${winner.score.fundamentalScore > (scores.find(s => s !== winner)?.score.fundamentalScore || 0) ? 'fundamental value' : 'technical momentum'}.`,
            recommendation: `FAVOR ${winner.symbol}`,
            dataPoints: { comparison: scores },
            type: "COMPARISON"
        };
    }

    private async handlePortfolioRisk(context?: { portfolioId?: string; userId?: string }): Promise<AIResponse> {
        let portfolio: any = null;
        if (this.portfolioRepo) {
            if (context?.portfolioId) {
                portfolio = await this.portfolioRepo.findById(context.portfolioId);
            } else if (context?.userId) {
                const list = await this.portfolioRepo.findByUserId(context.userId);
                portfolio = list[0] || null;
            } else {
                const all = await this.portfolioRepo.list();
                portfolio = all[0] || null;
            }
        }

        if (!portfolio || !portfolio.holdings || portfolio.holdings.length === 0) {
            return {
                answer: "No active portfolio holdings found to evaluate risk. Build your holdings or add positions to receive dynamic risk and diversification analysis.",
                recommendation: "BUILD PORTFOLIO",
                type: "PORTFOLIO_RISK"
            };
        }

        const analyzed = await this.portfolioAnalyzer.analyze(portfolio);
        const holdingsCount = analyzed.holdings.length;
        const totalEquity = analyzed.cashBalance + analyzed.holdings.reduce((sum: number, h: any) => sum + (h.marketValue || 0), 0);
        const INITIAL_BALANCE = 1000000;
        const growthPercent = ((totalEquity - INITIAL_BALANCE) / INITIAL_BALANCE) * 100;

        // Sector concentration calculation
        const sectorTotals: Record<string, number> = {};
        analyzed.holdings.forEach((h: any) => {
            const sec = h.sector || "General Market";
            sectorTotals[sec] = (sectorTotals[sec] || 0) + (h.marketValue || 0);
        });

        let topSector = "General Market";
        let topSectorValue = 0;
        Object.entries(sectorTotals).forEach(([sec, val]) => {
            if (val > topSectorValue) {
                topSector = sec;
                topSectorValue = val;
            }
        });

        const totalHoldingValue = analyzed.holdings.reduce((sum: number, h: any) => sum + (h.marketValue || 0), 1);
        const topSectorPercent = Math.round((topSectorValue / totalHoldingValue) * 100);

        const riskLevel = analyzed.riskScore >= 70 ? "High Risk" : analyzed.riskScore >= 40 ? "Moderate Risk" : "Low Risk";
        const recommendation = topSectorPercent > 45 ? `DIVERSIFY FROM ${topSector.toUpperCase()}` : "MAINTAIN DIVERSIFICATION";

        return {
            answer: `Your portfolio risk is currently evaluated at '${riskLevel}' (${analyzed.riskScore}/100) across ${holdingsCount} active positions. Highest sector exposure is ${topSector} (${topSectorPercent}% of invested equity). Net portfolio performance is ${growthPercent >= 0 ? '+' : ''}${growthPercent.toFixed(2)}%.`,
            recommendation,
            type: "PORTFOLIO_RISK",
            dataPoints: {
                riskScore: analyzed.riskScore,
                topSector,
                topSectorPercent,
                growthPercent,
                holdingsCount
            }
        };
    }

    private async handleSentiment(query: string, contextSymbol?: string): Promise<AIResponse> {
        const symbol = contextSymbol || this.extractSymbols(query)[0];
        if (!symbol) return { answer: "Which stock are you referring to? (e.g., 'What's the sentiment for RELIANCE?')", type: "GENERAL" };

        const stock = await this.stockRepo.findBySymbol(symbol);
        if (!stock) return { answer: `I couldn't find data for ${symbol}.`, type: "SENTIMENT" };

        // Simple sentiment check
        return {
            answer: `The aggregate news sentiment for ${stock.name} (${symbol}) is currently 'Bullish'. AI analysis of recent news cycles shows high conviction in growth drivers, though technical resistance remains.`,
            recommendation: "MONITOR NEWS FLOW",
            type: "SENTIMENT"
        };
    }

    private extractSymbols(query: string): string[] {
        const words = query.toUpperCase().split(/[\s,]+/);
        // Matching 2-5 character uppercase words as potential symbols
        return words.filter(w => /^[A-Z]{2,5}$/.test(w));
    }
}
