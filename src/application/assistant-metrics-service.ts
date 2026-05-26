import { IInfrastructure } from "./contracts/infrastructure";
import { StrategyAssistant } from "../domain/strategy-assistant";
import { calculateAssistantStats } from "./assistant-stats-calculator";

export class AssistantMetricsService {
    constructor(private infra: IInfrastructure) {}

    /**
     * Calculates stats dynamically for a single assistant.
     * Respects cache if ENABLE_ASSISTANT_METRICS is active.
     */
    public async getEnrichedAssistant(assistant: StrategyAssistant): Promise<any> {
        if (process.env.ENABLE_ASSISTANT_METRICS === "true") {
            const cached = await this.infra.assistantMetrics.findByAssistantId(assistant.id);
            if (cached) {
                return {
                    ...assistant,
                    totalPnL: cached.totalPnL,
                    winCount: cached.wins,
                    lossCount: cached.losses,
                    totalTradesExecuted: cached.totalTrades,
                    activeHoldings: cached.activeHoldings || []
                };
            }
        }

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

        if (process.env.ENABLE_ASSISTANT_METRICS === "true") {
            await this.infra.assistantMetrics.upsertMetrics({
                assistantId: assistant.id,
                totalPnL: stats.totalPnL,
                wins: stats.winCount,
                losses: stats.lossCount,
                totalTrades: stats.totalTradesExecuted,
                activeHoldings: stats.activeHoldings,
                updatedAt: new Date()
            }).catch(err => console.error("[AssistantMetricsService] Failed to cache metrics:", err));
        }

        return {
            ...assistant,
            ...stats
        };
    }

    /**
     * Calculates stats dynamically for an array of assistants belonging to the same user.
     * Respects cache if ENABLE_ASSISTANT_METRICS is active.
     */
    public async getEnrichedAssistants(assistants: StrategyAssistant[]): Promise<any[]> {
        if (assistants.length === 0) return [];
        
        if (process.env.ENABLE_ASSISTANT_METRICS === "true") {
            const cachedList = await Promise.all(
                assistants.map(async (assistant) => {
                    const cached = await this.infra.assistantMetrics.findByAssistantId(assistant.id);
                    if (cached) {
                        return {
                            assistantId: assistant.id,
                            enriched: {
                                ...assistant,
                                totalPnL: cached.totalPnL,
                                winCount: cached.wins,
                                lossCount: cached.losses,
                                totalTradesExecuted: cached.totalTrades,
                                activeHoldings: cached.activeHoldings || []
                            }
                        };
                    }
                    return { assistantId: assistant.id, enriched: null };
                })
            );

            const allCached = cachedList.every(c => c.enriched !== null);
            if (allCached) {
                return cachedList.map(c => c.enriched!);
            }
        }

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

        return Promise.all(assistants.map(async (assistant) => {
            const stats = calculateAssistantStats(assistant, trades, holdings);
            
            if (process.env.ENABLE_ASSISTANT_METRICS === "true") {
                await this.infra.assistantMetrics.upsertMetrics({
                    assistantId: assistant.id,
                    totalPnL: stats.totalPnL,
                    wins: stats.winCount,
                    losses: stats.lossCount,
                    totalTrades: stats.totalTradesExecuted,
                    activeHoldings: stats.activeHoldings,
                    updatedAt: new Date()
                }).catch(err => console.error("[AssistantMetricsService] Failed to cache metrics:", err));
            }

            return {
                ...assistant,
                ...stats
            };
        }));
    }

    /**
     * Recalculates metrics for a single assistant and persists them to the cache.
     * This is triggered during state transitions (e.g. exits, closures, or edits).
     */
    public async recalculateAndCache(assistant: StrategyAssistant): Promise<void> {
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

        await this.infra.assistantMetrics.upsertMetrics({
            assistantId: assistant.id,
            totalPnL: stats.totalPnL,
            wins: stats.winCount,
            losses: stats.lossCount,
            totalTrades: stats.totalTradesExecuted,
            activeHoldings: stats.activeHoldings,
            updatedAt: new Date()
        });
    }
}
