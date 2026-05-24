import { Infrastructure } from "../infrastructure/container";
import { LimitOrder, OrderStatus } from "../domain/limit-order";
import { NotificationService } from "./notification-service";
import { globalEvents } from "../infrastructure/events";
import { v4 as uuidv4 } from "uuid";

export class TradeMonitorService {
    private notificationService: NotificationService;

    constructor(private infra: Infrastructure) {
        this.notificationService = new NotificationService(infra.notification);
    }

    /**
     * Scans all pending orders, handles trailing stops, and executes them if conditions are met.
     */
    public async monitorAll(): Promise<{ executed: number; failed: number }> {
        const pendingOrders = await this.infra.limitOrder.findPending();
        if (pendingOrders.length === 0) return { executed: 0, failed: 0 };

        console.log(`[TradeMonitor] Scanning ${pendingOrders.length} pending orders...`);
        
        let executed = 0;
        let failed = 0;

        // Group by symbol to minimize market data calls
        const symbolGroups = this.groupBySymbol(pendingOrders);

        for (const [symbol, orders] of Object.entries(symbolGroups)) {
            try {
                const stock = await this.infra.market.getStockPrice(symbol);
                if (!stock || !stock.price) continue;

                const currentPrice = stock.price;

                for (const order of orders) {
                    try {
                        // 1. Handle Trailing Stop-Loss adjustments if applicable
                        if (order.type === 'STOP_LOSS' && order.botId) {
                            const bot = await this.infra.autoTradeBot.findById(order.botId);
                            if (bot && bot.useTrailingStop) {
                                const theoreticalStopPrice = parseFloat(
                                    (currentPrice * (1 - bot.stopLossPercent / 100)).toFixed(2)
                                );
                                if (theoreticalStopPrice > order.targetPrice) {
                                    const oldStop = order.targetPrice;
                                    order.targetPrice = theoreticalStopPrice;
                                    await this.infra.limitOrder.save(order);
                                    
                                    const trailMsg = `📈 Trailing SL Adjusted: Raised stop price for ${order.symbol.replace('.NS', '')} from ₹${oldStop.toFixed(2)} to ₹${theoreticalStopPrice.toFixed(2)} based on stock price rising to ₹${currentPrice.toFixed(2)}.`;
                                    await this.auditLog(bot.id, 'INFO', 'TRADE_EXIT', trailMsg, {
                                        symbol: order.symbol,
                                        oldStop,
                                        newStop: theoreticalStopPrice,
                                        currentPrice
                                    });
                                }
                            }
                        }

                        // 2. Check and execute trigger conditions
                        const shouldExecute = this.checkCondition(order, currentPrice);
                        if (shouldExecute) {
                            const success = await this.executeOrder(order, currentPrice);
                            if (success) executed++;
                            else failed++;
                        }
                    } catch (orderErr) {
                        console.error(`[TradeMonitor] Failed processing order ${order.id}:`, orderErr);
                        failed++;
                    }
                }
            } catch (err) {
                console.error(`[TradeMonitor] Failed to monitor ${symbol}:`, err);
                failed += orders.length;
            }
        }

        return { executed, failed };
    }

    private groupBySymbol(orders: LimitOrder[]): Record<string, LimitOrder[]> {
        return orders.reduce((acc, order) => {
            if (!acc[order.symbol]) acc[order.symbol] = [];
            acc[order.symbol].push(order);
            return acc;
        }, {} as Record<string, LimitOrder[]>);
    }

    private checkCondition(order: LimitOrder, currentPrice: number): boolean {
        switch (order.type) {
            case 'BUY':
                return currentPrice <= order.targetPrice;
            case 'SELL':
                return currentPrice >= order.targetPrice;
            case 'STOP_LOSS':
                return currentPrice <= order.targetPrice;
            case 'TAKE_PROFIT':
                return currentPrice >= order.targetPrice;
            default:
                return false;
        }
    }

    private async executeOrder(order: LimitOrder, executionPrice: number): Promise<boolean> {
        console.log(`[TradeMonitor] Executing ${order.type} for ${order.symbol} @ ${executionPrice} (Target: ${order.targetPrice})`);
        
        const maxRetries = 3;
        let attempt = 0;
        let success = false;
        let realizedPL = 0;

        const executeOrderTransaction = async (session?: any) => {
            // 1. Fetch user's portfolio
            const portfolios = await this.infra.portfolio.findByUserId(order.userId, session);
            if (!portfolios.length) throw new Error("Portfolio not found");
            const portfolio = portfolios[0];

            let tradeSource: any = 'limit_order';
            if (order.type === 'STOP_LOSS') tradeSource = 'stop_loss';
            else if (order.type === 'TAKE_PROFIT') tradeSource = 'take_profit';

            // 2. Perform the trade logic
            if (order.type === 'BUY') {
                const totalCost = order.quantity * executionPrice;
                if (portfolio.cashBalance < totalCost) {
                    await this.infra.limitOrder.updateStatus(order.id, 'EXPIRED', undefined, session);
                    return;
                }
                
                await this.infra.portfolio.executeTrade(
                    portfolio.id,
                    order.symbol,
                    order.quantity,
                    executionPrice,
                    'BUY',
                    session
                );

                await this.infra.trade.save({
                    id: uuidv4(),
                    userId: order.userId,
                    symbol: order.symbol,
                    quantity: order.quantity,
                    price: executionPrice,
                    totalValue: totalCost,
                    type: 'BUY',
                    source: tradeSource,
                    timestamp: new Date(),
                    botId: order.botId,
                }, session);
            } else {
                // SELL, STOP_LOSS, TAKE_PROFIT all act as SELLs
                const holding = portfolio.holdings.find(h => h.symbol === order.symbol);
                if (!holding || holding.quantity < order.quantity) {
                    await this.infra.limitOrder.updateStatus(order.id, 'EXPIRED', undefined, session);
                    return;
                }

                const averagePriceAtSale = holding.averagePrice;
                realizedPL = (executionPrice - averagePriceAtSale) * order.quantity;

                await this.infra.portfolio.executeTrade(
                    portfolio.id,
                    order.symbol,
                    order.quantity,
                    executionPrice,
                    'SELL',
                    session
                );

                await this.infra.trade.save({
                    id: uuidv4(),
                    userId: order.userId,
                    symbol: order.symbol,
                    quantity: order.quantity,
                    price: executionPrice,
                    totalValue: order.quantity * executionPrice,
                    type: 'SELL',
                    source: tradeSource,
                    timestamp: new Date(),
                    botId: order.botId,
                    realizedPL,
                    averagePriceAtSale
                }, session);

                // Handle Bot stats & Progressive budget release
                if (order.botId) {
                    const bot = await this.infra.autoTradeBot.findById(order.botId);
                    if (bot) {
                        const positionCost = order.quantity * averagePriceAtSale;
                        const newDeployed = Math.max(0, bot.deployedCash - positionCost);
                        const isWin = realizedPL > 0;

                        // Increment bot metrics
                        const updatedBotStats: Partial<any> = {
                            deployedCash: newDeployed,
                            totalPnL: bot.totalPnL + realizedPL,
                            winCount: bot.winCount + (isWin ? 1 : 0),
                            lossCount: bot.lossCount + (isWin ? 0 : 1),
                        };

                        await this.infra.autoTradeBot.updateStats(bot.id, updatedBotStats, session);

                        // Progressive Reservation Cash release if bot is PAUSED or STOPPED
                        if (bot.status === 'PAUSED' || bot.status === 'STOPPED') {
                            const updatedPortfolio = await this.infra.portfolio.findById(portfolio.id, session);
                            if (updatedPortfolio) {
                                updatedPortfolio.reservedCash = Math.max(0, (updatedPortfolio.reservedCash || 0) - positionCost);
                                await this.infra.portfolio.save(updatedPortfolio, session);
                                
                                const releaseMsg = `🔓 Progressive Release: Released ₹${positionCost.toFixed(2)} from portfolio reservedCash as position in ${order.symbol.replace('.NS', '')} was closed (Remaining reserved: ₹${(updatedPortfolio.reservedCash || 0).toFixed(2)}).`;
                                await this.auditLog(bot.id, 'INFO', 'TRADE_EXIT', releaseMsg, {
                                    symbol: order.symbol,
                                    releasedCash: positionCost,
                                    reservedCash: updatedPortfolio.reservedCash
                                });
                            }
                        }

                        // Log exit execution in terminal audit logs
                        const exitMsg = `📉 Exit Execution: Closed position for ${order.quantity} shares of ${order.symbol.replace('.NS', '')} @ ₹${executionPrice.toFixed(2)} via ${order.type} (Realized PnL: ₹${realizedPL.toFixed(2)} | Net Return: ${((realizedPL / positionCost) * 100).toFixed(2)}%).`;
                        await this.auditLog(bot.id, isWin ? 'INFO' : 'WARN', 'TRADE_EXIT', exitMsg, {
                            symbol: order.symbol,
                            qty: order.quantity,
                            exitPrice: executionPrice,
                            pnl: realizedPL
                        });
                    } else {
                        // Bot was deleted! Release the reserved cash progressively
                        const positionCost = order.quantity * averagePriceAtSale;
                        const updatedPortfolio = await this.infra.portfolio.findById(portfolio.id, session);
                        if (updatedPortfolio) {
                            updatedPortfolio.reservedCash = Math.max(0, (updatedPortfolio.reservedCash || 0) - positionCost);
                            await this.infra.portfolio.save(updatedPortfolio, session);
                        }
                    }
                }
            }

            // 3. Update order status to EXECUTED
            await this.infra.limitOrder.updateStatus(order.id, 'EXECUTED', executionPrice, session);

            // Cancel OCO partner order if it exists
            if (order.type === 'STOP_LOSS') {
                const pending = await this.infra.limitOrder.findPending();
                const partner = pending.find(o => o.parentOrderId === order.id && o.status === 'PENDING');
                if (partner) {
                    await this.infra.limitOrder.updateStatus(partner.id, 'CANCELLED', undefined, session);
                }
            } else if (order.type === 'TAKE_PROFIT' && order.parentOrderId) {
                const pending = await this.infra.limitOrder.findPending();
                const partner = pending.find(o => o.id === order.parentOrderId && o.status === 'PENDING');
                if (partner) {
                    await this.infra.limitOrder.updateStatus(partner.id, 'CANCELLED', undefined, session);
                }
            }
        };

        while (attempt < maxRetries) {
            attempt++;
            const session = this.infra.mongoClient ? this.infra.mongoClient.startSession() : null;
            try {
                if (session) {
                    await session.withTransaction(async () => {
                        await executeOrderTransaction(session);
                    });
                } else {
                    await executeOrderTransaction();
                }
                success = true;
                break;
            } catch (err: any) {
                if (session && session.inTransaction()) {
                    await session.abortTransaction();
                }
                const isVersionConflict = err.message?.includes("VersionConflictError");
                if (isVersionConflict && attempt < maxRetries) {
                    console.warn(`[TradeMonitor] VersionConflictError on attempt ${attempt}. Retrying limit order trade execution...`);
                    await new Promise(resolve => setTimeout(resolve, 100 * attempt));
                    continue;
                }
                console.error(`[TradeMonitor] Order execution failed permanently for ${order.id}:`, err.message || err);
                break;
            } finally {
                if (session) {
                    await session.endSession();
                }
            }
        }

        if (success) {
            // Notify user
            try {
                await this.notificationService.notifySignal(order.userId, {
                    symbol: order.symbol,
                    type: 'ORDER_EXECUTED',
                    strength: 'MEDIUM',
                    description: `Simulated ${order.type} order executed for ${order.quantity} shares of ${order.symbol.replace('.NS', '')} at ₹${executionPrice.toFixed(2)} (PnL: ₹${realizedPL.toFixed(2)}).`,
                    timestamp: new Date()
                });
            } catch (notifyErr) {
                console.error("[TradeMonitor] Failed to send notification:", notifyErr);
            }
        }

        return success;
    }

    private async auditLog(
        botId: string,
        level: "INFO" | "WARN" | "ERROR",
        category: "SCAN" | "TRADE_ENTRY" | "TRADE_EXIT" | "RISK_GUARD" | "SYSTEM",
        message: string,
        metadata?: any
    ): Promise<void> {
        try {
            await this.infra.autoTradeLog.save({
                id: "",
                botId,
                timestamp: new Date(),
                level,
                category,
                message,
                metadata,
                createdAt: new Date()
            });
            globalEvents.emitLog(botId, level, category, message, metadata);
        } catch (err) {
            console.error("[TradeMonitorService] Failed to write audit log:", err);
        }
    }
}
