import { IInfrastructure } from "./contracts/infrastructure";
import { StrategyAssistant } from "../domain/strategy-assistant";
import { DecisionService } from "./decision-service";
import { ExecutionService } from "./execution-service";
import { RiskGuardService } from "./risk-guard-service";
import { AuditLogService } from "./audit-log-service";
import { Portfolio } from "../domain/portfolio";
import { LimitOrder } from "../domain/limit-order";
import { DecisionReasoningService, signalExpiresAt } from "./decision-reasoning-service";
import { TimelineBufferService } from "./timeline-buffer-service";
import { AssistantSignal, SignalStatus } from "../domain/assistant-signal";
import { v4 as uuidv4 } from "uuid";

const EXPLAINABILITY_ENABLED = process.env.ENABLE_EXPLAINABILITY === 'true';

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
    private reasoningService: DecisionReasoningService;
    private timelineBuffer: TimelineBufferService;

    constructor(private infra: IInfrastructure) {
        this.decisionService = new DecisionService();
        this.executionService = new ExecutionService(infra);
        this.riskGuard = new RiskGuardService(infra);
        this.auditLogService = new AuditLogService(infra);
        this.reasoningService = new DecisionReasoningService();
        this.timelineBuffer = new TimelineBufferService(infra);
        if (EXPLAINABILITY_ENABLED) {
            this.timelineBuffer.start();
        }
    }

    public async runAssistant(
        assistant: StrategyAssistant,
        preloadedPortfolios?: Portfolio[],
        preloadedPendingOrders?: LimitOrder[]
    ): Promise<void> {
        const today = todayStr();

        // 1. Daily trade count reset
        if (assistant.todayDate !== today) {
            await this.infra.strategyAssistant.updateStats(assistant.id, { todayTradeCount: 0, todayDate: today });
            assistant.todayTradeCount = 0;
            assistant.todayDate = today;
        }

        // 2. Fetch portfolios to verify concurrent positions limit
        const portfolios = preloadedPortfolios
            ? preloadedPortfolios.filter(p => p.userId === assistant.userId)
            : await this.infra.portfolio.findByUserId(assistant.userId);

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
            const currentPortfolio = preloadedPortfolios
                ? preloadedPortfolios.find(p => p.userId === assistant.userId)
                : (await this.infra.portfolio.findByUserId(assistant.userId))[0];

            if (!currentPortfolio) {
                continue;
            }
            const currentHoldings = currentPortfolio.holdings.filter(h => h.botId === assistant.id) || [];
            if (currentHoldings.length >= assistant.maxConcurrentPositions) {
                break;
            }

            const symbol = rec.symbol;

            // Guard: Already have a pending BUY or active position for this symbol from this assistant?
            const pendingOrders = preloadedPendingOrders || await this.infra.limitOrder.findPending();
            const hasPendingBuy = pendingOrders.some(o => o.botId === assistant.id && o.symbol === symbol && o.type === 'BUY');
            if (hasPendingBuy) continue;

            const hasActivePosition = currentHoldings.some(h => h.symbol === symbol);
            if (hasActivePosition) continue;

            // ── Signal Queue: Create PENDING signal record ─────────────────────────
            let signalId: string | null = null;
            if (EXPLAINABILITY_ENABLED) {
                signalId = uuidv4();
                const pendingSignal: AssistantSignal = {
                    id: signalId,
                    assistantId: assistant.id,
                    symbol,
                    signalType: 'BUY',
                    strategy: assistant.strategySlug,
                    score: rec.score,
                    confidence: rec.score,
                    status: 'PENDING',
                    reasoning: {
                        decision: 'BUY',
                        confidence: rec.score,
                        reasons: [],
                        generatedAt: new Date()
                    },
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    expiresAt: null  // Active signal — no TTL yet
                };
                await this.infra.assistantSignal.save(pendingSignal);
                this.timelineBuffer.pushEvent(
                    assistant.id,
                    'SIGNAL_GENERATED',
                    `Signal Queued: ${symbol.replace('.NS', '')}`,
                    `Scanner found ${symbol.replace('.NS', '')} with score ${rec.score}/100. Entering evaluation.`
                );
                // Transition to PROCESSING
                await this.infra.assistantSignal.updateStatus(signalId, 'PROCESSING');
            }

            // Get current stock price
            let currentPrice: number;
            try {
                const stockData = await this.infra.market.getStockPrice(symbol);
                if (!stockData || !stockData.price || stockData.price <= 0) {
                    if (EXPLAINABILITY_ENABLED && signalId) {
                        await this.infra.assistantSignal.updateStatus(signalId, 'EXPIRED', undefined, signalExpiresAt());
                    }
                    continue;
                }
                currentPrice = stockData.price;
            } catch {
                if (EXPLAINABILITY_ENABLED && signalId) {
                    await this.infra.assistantSignal.updateStatus(signalId, 'EXPIRED', undefined, signalExpiresAt());
                }
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
                if (EXPLAINABILITY_ENABLED && signalId) {
                    const reasoning = this.reasoningService.buildRejectionReasoning(
                        assistant, rec, 'Insufficient capital or quantity too small for a valid position.'
                    );
                    await this.infra.assistantSignal.updateStatus(signalId, 'REJECTED', reasoning, signalExpiresAt());
                    this.timelineBuffer.pushEvent(
                        assistant.id,
                        'SIGNAL_REJECTED',
                        `Signal Rejected: ${symbol.replace('.NS', '')}`,
                        `Rejected — insufficient capital or zero quantity. Score: ${rec.score}/100.`,
                        { symbol, score: rec.score, reason: 'insufficient_capital' }
                    );
                }
                continue;
            }

            // Evaluate risk constraints
            const riskResult = await this.riskGuard.evaluateRisk(
                assistant,
                symbol,
                proposedTrade.cost,
                preloadedPendingOrders,
                preloadedPortfolios
            );
            if (!riskResult.allowed) {
                await this.auditLogService.log(
                    assistant.id,
                    'WARN',
                    'RISK_GUARD',
                    `Trade entry for ${symbol.replace('.NS', '')} blocked: ${riskResult.reason}`
                );
                if (EXPLAINABILITY_ENABLED && signalId) {
                    const reasoning = this.reasoningService.buildRejectionReasoning(
                        assistant, rec, riskResult.reason || 'Risk check failed.'
                    );
                    await this.infra.assistantSignal.updateStatus(signalId, 'REJECTED', reasoning, signalExpiresAt());
                    this.timelineBuffer.pushEvent(
                        assistant.id,
                        'SIGNAL_REJECTED',
                        `Signal Blocked: ${symbol.replace('.NS', '')}`,
                        `Risk guard blocked entry. ${riskResult.reason}`,
                        { symbol, score: rec.score, reason: riskResult.reason }
                    );
                }
                continue;
            }

            // Approve the signal — reasoning generated before execution
            if (EXPLAINABILITY_ENABLED && signalId) {
                const reasoning = this.reasoningService.buildApprovalReasoning(
                    assistant, rec, currentPortfolio, pendingOrders
                );
                await this.infra.assistantSignal.updateStatus(signalId, 'APPROVED', reasoning);
                this.timelineBuffer.pushEvent(
                    assistant.id,
                    'SIGNAL_APPROVED',
                    `Signal Approved: ${symbol.replace('.NS', '')}`,
                    `All risk checks passed. Confidence: ${reasoning.confidence}%. Proceeding to execute.`,
                    { symbol, score: rec.score, confidence: reasoning.confidence }
                );
            }

            // Execute BUY trade
            const executed = await this.executionService.executeBuyTrade(
                assistant,
                proposedTrade,
                strategy.id
            );

            if (executed) {
                // Transition signal to EXECUTED
                if (EXPLAINABILITY_ENABLED && signalId) {
                    await this.infra.assistantSignal.updateStatus(signalId, 'EXECUTED', undefined, signalExpiresAt());
                    this.timelineBuffer.pushEvent(
                        assistant.id,
                        'TRADE_EXECUTED',
                        `Trade Executed: ${symbol.replace('.NS', '')}`,
                        `Bought ${proposedTrade.quantity} shares at ₹${proposedTrade.price.toFixed(2)}. SL: ₹${proposedTrade.slPrice} | TP: ₹${proposedTrade.tpPrice}.`,
                        {
                            symbol,
                            quantity: proposedTrade.quantity,
                            price: proposedTrade.price,
                            slPrice: proposedTrade.slPrice,
                            tpPrice: proposedTrade.tpPrice,
                            cost: proposedTrade.cost
                        }
                    );
                }
                // If optimized, refresh preloaded lists to avoid stale state in next loop iterations
                if (preloadedPortfolios) {
                    const freshPortfolios = await this.infra.portfolio.findByUserId(assistant.userId);
                    if (freshPortfolios.length > 0) {
                        const idx = preloadedPortfolios.findIndex(p => p.userId === assistant.userId);
                        if (idx !== -1) {
                            preloadedPortfolios[idx] = freshPortfolios[0];
                        }
                    }
                }
                if (preloadedPendingOrders) {
                    const freshPending = await this.infra.limitOrder.findPending();
                    preloadedPendingOrders.length = 0;
                    preloadedPendingOrders.push(...freshPending);
                }
            }
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
