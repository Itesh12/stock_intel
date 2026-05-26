import { Infrastructure } from "../infrastructure/container";
import { StrategyAssistant } from "../domain/strategy-assistant";
import { calculateAssistantStats } from "./assistant-stats-calculator";

export class AssistantMetricsService {
    constructor(private infra: Infrastructure) {}

    /**
     * Calculates stats dynamically for a single assistant.
     * Does NOT write to the database (Read-only).
     */
    public async getEnrichedAssistant(assistant: StrategyAssistant): Promise<any> {
        const portfolios = await this.infra.portfolio.findByUserId(assistant.userId);
        const portfolio = portfolios[0] || null;
        let holdings: any[] = [];
        if (portfolio) {
            const analyzer = new (require("./portfolio-analyzer").PortfolioAnalyzer)(
                this.infra.stock, 
                this.infra.notification, 
                this.infra.trade,
                this.infra.market
            );
            const analyzed = await analyzer.analyze(portfolio);
            holdings = analyzed.holdings;
        }

        const trades = await this.infra.trade.findByUserId(assistant.userId);
        const stats = calculateAssistantStats(assistant, trades, holdings);

        return {
            ...assistant,
            ...stats
        };
    }

    /**
     * Calculates stats dynamically for an array of assistants belonging to the same user.
     * Does NOT write to the database (Read-only).
     */
    public async getEnrichedAssistants(assistants: StrategyAssistant[]): Promise<any[]> {
        if (assistants.length === 0) return [];
        
        // Since all assistants in the list belong to the same user (in current route/page scope),
        // we can fetch the user portfolio and trades once.
        const userId = assistants[0].userId;
        const portfolios = await this.infra.portfolio.findByUserId(userId);
        const portfolio = portfolios[0] || null;
        let holdings: any[] = [];
        if (portfolio) {
            const analyzer = new (require("./portfolio-analyzer").PortfolioAnalyzer)(
                this.infra.stock, 
                this.infra.notification, 
                this.infra.trade,
                this.infra.market
            );
            const analyzed = await analyzer.analyze(portfolio);
            holdings = analyzed.holdings;
        }

        const trades = await this.infra.trade.findByUserId(userId);

        return assistants.map(assistant => {
            const stats = calculateAssistantStats(assistant, trades, holdings);
            return {
                ...assistant,
                ...stats
            };
        });
    }
}
