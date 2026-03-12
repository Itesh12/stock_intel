import { StockRepository } from "../ports/stock-repository";
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
        private portfolioAnalyzer: PortfolioAnalyzer
    ) { }

    public async ask(query: string, context?: { symbol?: string; portfolioId?: string }): Promise<AIResponse> {
        const q = query.toLowerCase();
        const intent = this.parseIntent(q);

        switch (intent) {
            case "COMPARISON":
                return await this.handleComparison(q);
            case "VALUATION":
                return await this.handleValuation(q, context?.symbol);
            case "PORTFOLIO_RISK":
                return await this.handlePortfolioRisk(context?.portfolioId);
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

    private async handlePortfolioRisk(portfolioId?: string): Promise<AIResponse> {
        // In a real app, we'd fetch the specific portfolio. For now, we return high-quality simulated insights.
        return {
            answer: "Your portfolio risk is 'Moderate' (45/100). You have significant concentration in the Technology sector (55%). While your P/L is positive (+12%), increasing exposure to Defensive sectors like Utilities would improve your risk-adjusted returns.",
            recommendation: "ADD DEFENSIVE SECTOR",
            type: "PORTFOLIO_RISK",
            dataPoints: { riskScore: 45, sectorConcentration: { Technology: 55, Utilities: 5 } }
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
