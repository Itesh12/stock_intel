import { StockRepository } from "../ports/stock-repository";
import { ScoringService } from "./scoring-service";
import { PortfolioAnalyzer } from "./portfolio-analyzer";

export interface AIResponse {
    answer: string;
    dataPoints?: any;
    recommendation?: string;
}

export class AICopilotService {
    constructor(
        private stockRepo: StockRepository,
        private scoringService: ScoringService,
        private portfolioAnalyzer: PortfolioAnalyzer
    ) { }

    public async ask(query: string, context?: { symbol?: string; portfolioId?: string }): Promise<AIResponse> {
        const q = query.toLowerCase();

        // 1. Handle "Is [Stock] overvalued?"
        if (q.includes("overvalued") || q.includes("valuation")) {
            const symbol = context?.symbol || this.extractSymbol(q);
            if (!symbol) return { answer: "Which stock are you referring to? Please specify a symbol like 'AAPL'." };

            const stock = await this.stockRepo.findBySymbol(symbol);
            if (!stock) return { answer: `I couldn't find data for ${symbol}.` };

            const score = this.scoringService.calculateScore(stock, {});

            let valuationText = "fairly valued";
            if (score.fundamentalScore < 40) valuationText = "potentially overvalued based on fundamental metrics";
            if (score.fundamentalScore > 80) valuationText = "undervalued relative to its sector peers";

            return {
                answer: `Based on my analysis of ${stock.name} (${symbol}), it appears to be ${valuationText}. Its fundamental score is ${score.fundamentalScore}/100.`,
                recommendation: score.overallScore > 75 ? "BUY" : "HOLD",
                dataPoints: { score }
            };
        }

        // 2. Handle Portfolio Risk queries
        if (q.includes("risk") && q.includes("portfolio")) {
            // Mocked response for now, in prod would fetch actual portfolio
            return {
                answer: "Your portfolio risk is currently rated as 'Low' (24/100). However, you have high concentration in the Technology sector (64%). I recommend diversifying into Healthcare or Energy to reduce potential drawdown.",
                recommendation: "DIVERSIFY"
            };
        }

        return {
            answer: "I'm your StockIntel Copilot. You can ask me about stock valuations, portfolio risk, or market signals. For example: 'Is NVDA overvalued?'"
        };
    }

    private extractSymbol(query: string): string | null {
        const symbols = ["AAPL", "NVDA", "TSLA", "MSFT", "PLTR", "AMD"];
        for (const s of symbols) {
            if (query.toUpperCase().includes(s)) return s;
        }
        return null;
    }
}
