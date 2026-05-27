import { IInfrastructure } from "./contracts/infrastructure";
import { LimitOrder } from "../domain/limit-order";
import { NotificationService } from "./notification-service";
import { v4 as uuidv4 } from "uuid";
import { AuditLogService } from "./audit-log-service";
import { CapitalReservationService } from "./capital-reservation-service";

export class TradeMonitorService {
    private notificationService: NotificationService;
    private auditLogService: AuditLogService;

    constructor(private infra: IInfrastructure) {
        this.notificationService = new NotificationService(infra.notification);
        this.auditLogService = new AuditLogService(infra);
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
                            const assistant = await this.infra.strategyAssistant.findById(order.botId);

                            if (assistant && assistant.useTrailingStop) {
                                const theoreticalStopPrice = parseFloat(
                                    (currentPrice * (1 - assistant.stopLossPercent / 100)).toFixed(2)
                                );
                                if (theoreticalStopPrice > order.targetPrice) {
                                    const oldStop = order.targetPrice;
                                    order.targetPrice = theoreticalStopPrice;
                                    await this.infra.limitOrder.save(order);
                                    
                                    const trailMsg = `📈 Trailing SL Adjusted: Raised stop price for ${order.symbol.replace('.NS', '')} from ₹${oldStop.toFixed(2)} to ₹${theoreticalStopPrice.toFixed(2)} based on stock price rising to ₹${currentPrice.toFixed(2)}.`;
                                    await this.auditLogService.log(assistant.id, 'INFO', 'TRADE_EXIT', trailMsg, {
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

                // Handle Bot/Assistant stats & Progressive budget release
                if (order.botId) {
                    const assistant = await this.infra.strategyAssistant.findById(order.botId);

                    if (assistant) {
                        const positionCost = order.quantity * averagePriceAtSale;
                        const newDeployed = Math.max(0, assistant.deployedCapital - positionCost);
                        const isWin = realizedPL > 0;

                        // Increment assistant metrics
                        const updatedAssistantStats = {
                            deployedCapital: newDeployed,
                            totalPnL: assistant.totalPnL + realizedPL,
                            winCount: assistant.winCount + (isWin ? 1 : 0),
                            lossCount: assistant.lossCount + (isWin ? 0 : 1),
                            totalTradesExecuted: assistant.totalTradesExecuted + 1,
                        };

                        await this.infra.strategyAssistant.updateStats(assistant.id, updatedAssistantStats, session);

                        // Recalculate reservedCash dynamically to avoid arithmetic drift
                        const reservationService = new CapitalReservationService(this.infra);
                        await reservationService.syncReservedCash(assistant.userId, session);

                        // Log exit execution in terminal audit logs
                        const exitMsg = `📉 Exit Execution: Closed position for ${order.quantity} shares of ${order.symbol.replace('.NS', '')} @ ₹${executionPrice.toFixed(2)} via ${order.type} (Realized PnL: ₹${realizedPL.toFixed(2)} | Net Return: ${((realizedPL / positionCost) * 100).toFixed(2)}%).`;
                        await this.auditLogService.log(assistant.id, isWin ? 'INFO' : 'WARN', 'TRADE_EXIT', exitMsg, {
                            symbol: order.symbol,
                            qty: order.quantity,
                            exitPrice: executionPrice,
                            pnl: realizedPL
                        });
                    } else {
                        // Bot/Assistant was deleted! Sync reservedCash
                        const reservationService = new CapitalReservationService(this.infra);
                        await reservationService.syncReservedCash(portfolio.userId, session);
                    }
                }
            }

            // 3. Update order status to EXECUTED
            await this.infra.limitOrder.updateStatus(order.id, 'EXECUTED', executionPrice, session);

            // Cancel OCO partner order if it exists
            if (order.type === 'STOP_LOSS' || (order.type === 'TAKE_PROFIT' && order.parentOrderId)) {
                await this.infra.limitOrder.cancelCompanion(order.id, order.parentOrderId, session);
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

            // Recalculate metrics cache on trade exit if botId is present and metrics cache is enabled
            if (order.botId && process.env.ENABLE_ASSISTANT_METRICS === "true") {
                try {
                    const assistant = await this.infra.strategyAssistant.findById(order.botId);
                    if (assistant) {
                        const metricsService = new (require("./assistant-metrics-service").AssistantMetricsService)(this.infra);
                        await metricsService.recalculateAndCache(assistant);
                    }
                } catch (metricsErr) {
                    console.error("[TradeMonitor] Failed to update assistant metrics cache:", metricsErr);
                }
            }
        }

        return success;
    }
}
