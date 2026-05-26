import { Infrastructure } from "../infrastructure/container";
import { StrategyAssistant } from "../domain/strategy-assistant";
import { LimitOrder } from "../domain/limit-order";
import { v4 as uuidv4 } from "uuid";
import { AuditLogService } from "./audit-log-service";

export class AssistantLifecycleService {
    private auditLogService: AuditLogService;
    constructor(private infra: Infrastructure) {
        this.auditLogService = new AuditLogService(infra);
    }
    /**
     * Deploys a new strategy assistant, locking allocated capital.
     */
    public async createAssistant(assistant: StrategyAssistant): Promise<void> {
        const session = this.infra.mongoClient ? this.infra.mongoClient.startSession() : null;
        let success = false;

        const executeTransaction = async (sess?: any) => {
            const portfolios = await this.infra.portfolio.findByUserId(assistant.userId, sess);
            if (portfolios.length === 0) throw new Error("Portfolio not found. Configure a portfolio first.");
            const portfolio = portfolios[0];

            const availablePortfolioCash = portfolio.cashBalance - (portfolio.reservedCash || 0);
            if (availablePortfolioCash < assistant.allocatedCapital) {
                throw new Error(`Insufficient funds: Allocated capital (₹${assistant.allocatedCapital.toLocaleString()}) exceeds available cash (₹${availablePortfolioCash.toLocaleString()}).`);
            }

            // Lock budget in reservedCash
            portfolio.reservedCash = (portfolio.reservedCash || 0) + assistant.allocatedCapital;
            await this.infra.portfolio.save(portfolio, sess);

            // Save assistant config
            await this.infra.strategyAssistant.save(assistant);
        };

        try {
            if (session) {
                await session.withTransaction(async () => {
                    await executeTransaction(session);
                });
            } else {
                await executeTransaction();
            }
            success = true;
        } finally {
            if (session) {
                await session.endSession();
            }
        }

        if (success) {
            await this.auditLogService.log(assistant.id, 'INFO', 'SYSTEM', `🤖 Assistant Deployed: "${assistant.name}" active on ${assistant.strategyName}. Reserved Capital: ₹${assistant.allocatedCapital.toLocaleString()}.`);
        }
    }

    /**
     * Pauses a running assistant, releasing non-deployed capital.
     */
    public async pauseAssistant(assistantId: string, userId: string): Promise<void> {
        const session = this.infra.mongoClient ? this.infra.mongoClient.startSession() : null;
        let success = false;

        const executeTransaction = async (sess?: any) => {
            const assistant = await this.infra.strategyAssistant.findById(assistantId);
            if (!assistant || assistant.userId !== userId) throw new Error("Assistant not found");
            if (assistant.status !== 'RUNNING') throw new Error("Assistant is not running");

            const portfolios = await this.infra.portfolio.findByUserId(userId, sess);
            if (portfolios.length === 0) throw new Error("Portfolio not found");
            const portfolio = portfolios[0];

            // Release non-deployed budget from reservedCash
            const releasableCapital = assistant.allocatedCapital - assistant.deployedCapital;
            if (releasableCapital > 0) {
                portfolio.reservedCash = Math.max(0, (portfolio.reservedCash || 0) - releasableCapital);
                await this.infra.portfolio.save(portfolio, sess);
            }

            // Update status
            assistant.status = 'PAUSED';
            await this.infra.strategyAssistant.save(assistant);
        };

        try {
            if (session) {
                await session.withTransaction(async () => {
                    await executeTransaction(session);
                });
            } else {
                await executeTransaction();
            }
            success = true;
        } finally {
            if (session) {
                await session.endSession();
            }
        }

        if (success) {
            await this.auditLogService.log(assistantId, 'INFO', 'SYSTEM', `🔧 Assistant Paused. Non-deployed budget released to portfolio cash.`);
        }
    }

    /**
     * Resumes a paused assistant, re-locking non-deployed capital.
     */
    public async resumeAssistant(assistantId: string, userId: string): Promise<void> {
        const session = this.infra.mongoClient ? this.infra.mongoClient.startSession() : null;
        let success = false;

        const executeTransaction = async (sess?: any) => {
            const assistant = await this.infra.strategyAssistant.findById(assistantId);
            if (!assistant || assistant.userId !== userId) throw new Error("Assistant not found");
            if (assistant.status !== 'PAUSED' && assistant.status !== 'RISK_STOPPED') {
                throw new Error("Assistant is not in a resumeable state");
            }

            const portfolios = await this.infra.portfolio.findByUserId(userId, sess);
            if (portfolios.length === 0) throw new Error("Portfolio not found");
            const portfolio = portfolios[0];

            // Re-lock non-deployed budget
            const toReserve = assistant.allocatedCapital - assistant.deployedCapital;
            if (toReserve > 0) {
                const available = portfolio.cashBalance - (portfolio.reservedCash || 0);
                if (available < toReserve) {
                    throw new Error(`Insufficient funds: Re-locking budget of ₹${toReserve.toLocaleString()} exceeds available cash (₹${available.toLocaleString()}).`);
                }
                portfolio.reservedCash = (portfolio.reservedCash || 0) + toReserve;
                await this.infra.portfolio.save(portfolio, sess);
            }

            // Update status
            assistant.status = 'RUNNING';
            await this.infra.strategyAssistant.save(assistant);
        };

        try {
            if (session) {
                await session.withTransaction(async () => {
                    await executeTransaction(session);
                });
            } else {
                await executeTransaction();
            }
            success = true;
        } finally {
            if (session) {
                await session.endSession();
            }
        }

        if (success) {
            await this.auditLogService.log(assistantId, 'INFO', 'SYSTEM', `⚡ Assistant Resumed. Capital reserved and scanner checks active.`);
        }
    }

    /**
     * Deletes an assistant. Option parameter dictates whether to liquidate or convert holdings.
     */
    public async deleteAssistant(assistantId: string, userId: string, liquidate: boolean): Promise<void> {
        const session = this.infra.mongoClient ? this.infra.mongoClient.startSession() : null;
        let success = false;

        const executeTransaction = async (sess?: any) => {
            const assistant = await this.infra.strategyAssistant.findById(assistantId);
            if (!assistant || assistant.userId !== userId) throw new Error("Assistant not found");

            const portfolios = await this.infra.portfolio.findByUserId(userId, sess);
            if (portfolios.length === 0) throw new Error("Portfolio not found");
            const portfolio = portfolios[0];

            // 1. Release non-deployed budget if running
            let releasable = 0;
            if (assistant.status === 'RUNNING') {
                releasable = assistant.allocatedCapital - assistant.deployedCapital;
            }

            if (releasable > 0) {
                portfolio.reservedCash = Math.max(0, (portfolio.reservedCash || 0) - releasable);
            }

            // 2. Handle active holdings
            const openHoldings = portfolio.holdings.filter(h => h.botId === assistantId);

            if (liquidate) {
                // Sell all managed positions at current market rates
                for (const holding of openHoldings) {
                    const stockData = await this.infra.market.getStockPrice(holding.symbol);
                    const currentPrice = stockData?.price || holding.currentPrice;
                    const entryCost = holding.quantity * holding.averagePrice;
                    const saleValue = holding.quantity * currentPrice;
                    const realizedPL = saleValue - entryCost;

                    await this.infra.portfolio.executeTrade(portfolio.id, holding.symbol, holding.quantity, currentPrice, 'SELL', sess);

                    await this.infra.trade.save({
                        id: uuidv4(),
                        userId,
                        symbol: holding.symbol,
                        quantity: holding.quantity,
                        price: currentPrice,
                        totalValue: saleValue,
                        type: 'SELL',
                        source: 'limit_order',
                        timestamp: new Date(),
                        realizedPL,
                        averagePriceAtSale: holding.averagePrice,
                        botId: assistantId
                    }, sess);
                }

                // Fully clear reserved cash of deployed portion
                portfolio.reservedCash = Math.max(0, (portfolio.reservedCash || 0) - assistant.deployedCapital);
            } else {
                // Convert positions to manual (detaches holding from botId)
                for (const holding of portfolio.holdings) {
                    if (holding.botId === assistantId) {
                        delete holding.botId;
                    }
                }
            }

            // 3. Cancel companion exit orders
            const pendingOrders = await this.infra.limitOrder.findPending();
            const assistantPending = pendingOrders.filter(o => o.botId === assistantId);
            for (const order of assistantPending) {
                await this.infra.limitOrder.updateStatus(order.id, 'CANCELLED', undefined, sess);
            }

            // 4. Save portfolio and delete assistant + logs
            await this.infra.portfolio.save(portfolio, sess);
            await this.infra.strategyAssistant.delete(assistantId);
            await this.infra.assistantLog.deleteByBotId(assistantId);
        };

        try {
            if (session) {
                await session.withTransaction(async () => {
                    await executeTransaction(session);
                });
            } else {
                await executeTransaction();
            }
            success = true;
        } finally {
            if (session) {
                await session.endSession();
            }
        }
    }

    /**
     * Converts a specific symbol holding from assistant-managed to manual control.
     */
    public async convertHoldingToManual(assistantId: string, userId: string, symbol: string): Promise<void> {
        const session = this.infra.mongoClient ? this.infra.mongoClient.startSession() : null;
        let success = false;

        const executeTransaction = async (sess?: any) => {
            const assistant = await this.infra.strategyAssistant.findById(assistantId);
            if (!assistant || assistant.userId !== userId) throw new Error("Assistant not found");

            const portfolios = await this.infra.portfolio.findByUserId(userId, sess);
            if (portfolios.length === 0) throw new Error("Portfolio not found");
            const portfolio = portfolios[0];

            const holding = portfolio.holdings.find(h => h.symbol === symbol && h.botId === assistantId);
            if (!holding) throw new Error("Managed position not found");

            const positionCost = holding.quantity * holding.averagePrice;

            // 1. Remove botId link
            delete holding.botId;

            // 2. Cancel exit orders
            const pendingOrders = await this.infra.limitOrder.findPending();
            const assistantPending = pendingOrders.filter(o => o.botId === assistantId && o.symbol === symbol);
            for (const order of assistantPending) {
                await this.infra.limitOrder.updateStatus(order.id, 'CANCELLED', undefined, sess);
            }

            // 3. Update assistant capital boundaries and release reserved cash
            assistant.deployedCapital = Math.max(0, assistant.deployedCapital - positionCost);
            assistant.allocatedCapital = Math.max(0, assistant.allocatedCapital - positionCost);
            await this.infra.strategyAssistant.save(assistant);

            // Release portfolio reservedCash reservation since capital budget decreases
            portfolio.reservedCash = Math.max(0, (portfolio.reservedCash || 0) - positionCost);
            await this.infra.portfolio.save(portfolio, sess);
        };

        try {
            if (session) {
                await session.withTransaction(async () => {
                    await executeTransaction(session);
                });
            } else {
                await executeTransaction();
            }
            success = true;
        } finally {
            if (session) {
                await session.endSession();
            }
        }

        if (success) {
            await this.auditLogService.log(assistantId, 'INFO', 'SYSTEM', `🔓 Position Converted: Closed automated execution rules for ${symbol.replace('.NS', '')}. Exits cancelled.`);
        }
    }

    /**
     * Liquidates a single position managed by the assistant.
     */
    public async closePosition(assistantId: string, userId: string, symbol: string): Promise<void> {
        const session = this.infra.mongoClient ? this.infra.mongoClient.startSession() : null;
        let success = false;

        const executeTransaction = async (sess?: any) => {
            const assistant = await this.infra.strategyAssistant.findById(assistantId);
            if (!assistant || assistant.userId !== userId) throw new Error("Assistant not found");

            const portfolios = await this.infra.portfolio.findByUserId(userId, sess);
            if (portfolios.length === 0) throw new Error("Portfolio not found");
            const portfolio = portfolios[0];

            const holding = portfolio.holdings.find(h => h.symbol === symbol && h.botId === assistantId);
            if (!holding) throw new Error("Managed position not found");

            const entryCost = holding.quantity * holding.averagePrice;

            // Fetch current price
            const stockData = await this.infra.market.getStockPrice(symbol);
            const currentPrice = stockData?.price || holding.currentPrice;
            const saleValue = holding.quantity * currentPrice;
            const realizedPL = saleValue - entryCost;

            // Execute sell
            await this.infra.portfolio.executeTrade(portfolio.id, symbol, holding.quantity, currentPrice, 'SELL', sess);

            // Save trade ledger
            await this.infra.trade.save({
                id: uuidv4(),
                userId,
                symbol,
                quantity: holding.quantity,
                price: currentPrice,
                totalValue: saleValue,
                type: 'SELL',
                source: 'limit_order',
                timestamp: new Date(),
                realizedPL,
                averagePriceAtSale: holding.averagePrice,
                botId: assistantId
            }, sess);

            // Cancel exit orders
            const pendingOrders = await this.infra.limitOrder.findPending();
            const assistantPending = pendingOrders.filter(o => o.botId === assistantId && o.symbol === symbol);
            for (const order of assistantPending) {
                await this.infra.limitOrder.updateStatus(order.id, 'CANCELLED', undefined, sess);
            }

            // Update stats
            assistant.deployedCapital = Math.max(0, assistant.deployedCapital - entryCost);
            assistant.allocatedCapital = Math.max(0, assistant.allocatedCapital - entryCost);
            assistant.totalPnL += realizedPL;
            if (realizedPL > 0) assistant.winCount++;
            else if (realizedPL < 0) assistant.lossCount++;
            await this.infra.strategyAssistant.save(assistant);

            // Release portfolio reservedCash
            portfolio.reservedCash = Math.max(0, (portfolio.reservedCash || 0) - entryCost);
            await this.infra.portfolio.save(portfolio, sess);
        };

        try {
            if (session) {
                await session.withTransaction(async () => {
                    await executeTransaction(session);
                });
            } else {
                await executeTransaction();
            }
            success = true;
        } finally {
            if (session) {
                await session.endSession();
            }
        }

        if (success) {
            await this.auditLogService.log(assistantId, 'INFO', 'SYSTEM', `📉 Position Liquidated: Closed ${symbol.replace('.NS', '')} manually via dashboard trigger.`);
        }
    }

    /**
     * Emergency global kill switch. Pauses all assistants and liquidates ONLY assistant-managed positions.
     */
    public async emergencyStop(userId: string, flattenPositions: boolean): Promise<any> {
        const session = this.infra.mongoClient ? this.infra.mongoClient.startSession() : null;
        let success = false;
        let pausedCount = 0;
        let cancelledCount = 0;
        let liquidatedCount = 0;

        const executeTransaction = async (sess?: any) => {
            const portfolios = await this.infra.portfolio.findByUserId(userId, sess);
            if (portfolios.length === 0) throw new Error("Portfolio not found");
            const portfolio = portfolios[0];

            const assistants = await this.infra.strategyAssistant.findByUserId(userId);
            const runningAssistants = assistants.filter(a => a.status === 'RUNNING');

            for (const assistant of runningAssistants) {
                let releaseCapital = assistant.allocatedCapital - assistant.deployedCapital;
                if (flattenPositions) {
                    releaseCapital = assistant.allocatedCapital;
                    assistant.deployedCapital = 0;
                }

                portfolio.reservedCash = Math.max(0, (portfolio.reservedCash || 0) - releaseCapital);
                assistant.status = 'PAUSED';
                await this.infra.strategyAssistant.save(assistant);
                pausedCount++;

                await this.auditLogService.log(assistant.id, 'ERROR', 'SYSTEM', `🚨 Emergency Stop triggered! Assistant paused ${flattenPositions ? 'and positions flattened' : 'gracefully'}.`);
            }

            // Cancel pending limit orders placed by assistants
            const pendingOrders = await this.infra.limitOrder.findPending();
            const userAssistantPending = pendingOrders.filter(o => o.userId === userId && o.botId);
            for (const order of userAssistantPending) {
                await this.infra.limitOrder.updateStatus(order.id, 'CANCELLED', undefined, sess);
                cancelledCount++;
            }

            // Flatten positions ONLY matching botId references (protects manual portfolio holdings)
            if (flattenPositions && portfolio.holdings.length > 0) {
                const currentHoldings = [...portfolio.holdings];
                for (const holding of currentHoldings) {
                    if (holding.botId) {
                        const stockData = await this.infra.market.getStockPrice(holding.symbol);
                        const currentPrice = stockData?.price || holding.currentPrice;
                        const entryCost = holding.quantity * holding.averagePrice;
                        const saleValue = holding.quantity * currentPrice;
                        const realizedPL = saleValue - entryCost;

                        await this.infra.portfolio.executeTrade(portfolio.id, holding.symbol, holding.quantity, currentPrice, 'SELL', sess);

                        await this.infra.trade.save({
                            id: uuidv4(),
                            userId,
                            symbol: holding.symbol,
                            quantity: holding.quantity,
                            price: currentPrice,
                            totalValue: saleValue,
                            type: 'SELL',
                            source: 'limit_order',
                            timestamp: new Date(),
                            realizedPL,
                            averagePriceAtSale: holding.averagePrice,
                            botId: holding.botId
                        }, sess);

                        liquidatedCount++;
                    }
                }
                portfolio.reservedCash = 0;
            }

            await this.infra.portfolio.save(portfolio, sess);
        };

        try {
            if (session) {
                await session.withTransaction(async () => {
                    await executeTransaction(session);
                });
            } else {
                await executeTransaction();
            }
            success = true;
        } finally {
            if (session) {
                await session.endSession();
            }
        }

        return {
            pausedCount,
            cancelledCount,
            liquidatedCount
        };
    }
}
