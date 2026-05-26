import { Infrastructure } from "../infrastructure/container";
import { StrategyAssistant } from "../domain/strategy-assistant";
import { DecisionService } from "./decision-service";
import { ExecutionService } from "./execution-service";
import { RiskGuardService } from "./risk-guard-service";
import { AuditLogService } from "./audit-log-service";

// IST market hours: 9:30 AM - 2:30 PM
const MARKET_OPEN_HOUR = 9;
const MARKET_OPEN_MIN = 30;
const MARKET_CLOSE_HOUR = 14;
const MARKET_CLOSE_MIN = 29; // Keep buffer for close

function isMarketOpen(): boolean {
    const now = new Date();
    // IST = UTC+5:30
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
    const istMs = utcMs + 5.5 * 3600000;
    const ist = new Date(istMs);
    const h = ist.getHours();
    const m = ist.getMinutes();
    const totalMin = h * 60 + m;
    const openMin = MARKET_OPEN_HOUR * 60 + MARKET_OPEN_MIN;
    const closeMin = MARKET_CLOSE_HOUR * 60 + MARKET_CLOSE_MIN;
    return totalMin >= openMin && totalMin <= closeMin;
}

function todayStr(): string {
    const now = new Date();
    return now.toISOString().slice(0, 10);
}

export class SignalService {
    private decisionService: DecisionService;
    private executionService: ExecutionService;
    private riskGuard: RiskGuardService;
    private auditLogService: AuditLogService;

    constructor(private infra: Infrastructure) {
        this.decisionService = new DecisionService();
        this.executionService = new ExecutionService(infra);
        this.riskGuard = new RiskGuardService(infra);
        this.auditLogService = new AuditLogService(infra);
    }

    public async runAssistant(assistant: StrategyAssistant): Promise<void> {
        const today = todayStr();

        // 1. Daily trade count reset
        if (assistant.todayDate !== today) {
            await this.infra.strategyAssistant.updateStats(assistant.id, { todayTradeCount: 0, todayDate: today });
            assistant.todayTradeCount = 0;
            assistant.todayDate = today;
        }

        // 2. Fetch portfolios to verify concurrent positions limit
        const portfolios = await this.infra.portfolio.findByUserId(assistant.userId);
        if (portfolios.length === 0) {
            await this.auditLogService.log(assistant.id, 'WARN', 'SYSTEM', `No portfolio configured for user.`);
            return;
        }
        const portfolio = portfolios[0];

        const openHoldings = portfolio.holdings.filter(h => h.botId === assistant.id);
        if (openHoldings.length >= assistant.maxConcurrentPositions) {
            // Already filled concurrent position slots, skip new entries
            return;
        }

        // 3. Market hours guard for intraday strategies
        if (assistant.strategySlug.includes('intraday') && !isMarketOpen()) {
            return;
        }

        // 4. Fetch strategy scanner recommendations
        const strategy = await this.infra.strategy.findBySlug(assistant.strategySlug);
        if (!strategy) {
            await this.auditLogService.log(assistant.id, 'WARN', 'SCAN', `Associated strategy "${assistant.strategySlug}" not found in database.`);
            return;
        }

        const recommendations = await this.infra.strategy.getRecommendations(strategy.id);

        // Audit log scanner run
        await this.auditLogService.log(
            assistant.id,
            'INFO',
            'SCAN',
            `Strategy scan complete. Found ${recommendations.length} signals for ${assistant.strategyName || assistant.strategySlug}.`
        );

        if (recommendations.length === 0) return;

        // 5. Confluence matching threshold
        const qualifiedRecs = recommendations.filter(r => r.score >= assistant.minConfluenceScore);
        if (qualifiedRecs.length === 0) {
            await this.auditLogService.log(
                assistant.id,
                'INFO',
                'SCAN',
                `No signals met the minimum confluence score threshold of ${assistant.minConfluenceScore}.`
            );
            return;
        }

        // 6. Iterate and execute signals
        for (const rec of qualifiedRecs) {
            // Re-evaluate portfolio holdings capacity in case previous loop entered a position
            const currentPortfolio = (await this.infra.portfolio.findByUserId(assistant.userId))[0];
            const currentHoldings = currentPortfolio?.holdings.filter(h => h.botId === assistant.id) || [];
            if (currentHoldings.length >= assistant.maxConcurrentPositions) {
                break;
            }

            const symbol = rec.symbol;

            // Guard: Already have a pending BUY or active position for this symbol from this assistant?
            const pendingOrders = await this.infra.limitOrder.findPending();
            const hasPendingBuy = pendingOrders.some(o => o.botId === assistant.id && o.symbol === symbol && o.type === 'BUY');
            if (hasPendingBuy) continue;

            const hasActivePosition = currentHoldings.some(h => h.symbol === symbol);
            if (hasActivePosition) continue;

            // Get current stock price
            let currentPrice: number;
            try {
                const stockData = await this.infra.market.getStockPrice(symbol);
                if (!stockData || !stockData.price || stockData.price <= 0) continue;
                currentPrice = stockData.price;
            } catch {
                continue;
            }

            // Sizing and targets calculation
            const proposedTrade = this.decisionService.evaluateSignal(
                assistant,
                currentPortfolio,
                symbol,
                currentPrice,
                rec.score
            );

            if (!proposedTrade) {
                continue;
            }

            // Evaluate risk constraints
            const riskResult = await this.riskGuard.evaluateRisk(assistant, symbol, proposedTrade.cost);
            if (!riskResult.allowed) {
                await this.auditLogService.log(
                    assistant.id,
                    'WARN',
                    'RISK_GUARD',
                    `Trade entry for ${symbol.replace('.NS', '')} blocked: ${riskResult.reason}`
                );
                continue;
            }

            // Execute BUY trade
            await this.executionService.executeBuyTrade(
                assistant,
                proposedTrade,
                strategy.id
            );
        }
    }

    public async logError(assistantId: string, err: any): Promise<void> {
        await this.auditLogService.log(
            assistantId,
            'ERROR',
            'SYSTEM',
            `Assistant execution loop error: ${err instanceof Error ? err.message : String(err)}`
        );
    }
}
