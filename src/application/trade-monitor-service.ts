import { Infrastructure } from "../infrastructure/container";
import { LimitOrder, OrderStatus } from "../domain/limit-order";
import { NotificationService } from "./notification-service";

export class TradeMonitorService {
    constructor(private infra: Infrastructure) { }

    /**
     * Scans all pending orders and executes them if conditions are met.
     * This is the engine of the "SIM" environment.
     */
    public async monitorAll(): Promise<{ executed: number; failed: number }> {
        const pendingOrders = await this.infra.limitOrder.findPending();
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
                    const shouldExecute = this.checkCondition(order, currentPrice);
                    if (shouldExecute) {
                        const success = await this.executeOrder(order, currentPrice);
                        if (success) executed++;
                        else failed++;
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
                // Limit BUY: Price falls to or below target
                return currentPrice <= order.targetPrice;
            case 'SELL':
                // Limit SELL: Price rises to or above target
                return currentPrice >= order.targetPrice;
            case 'STOP_LOSS':
                // SELL order triggered when price falls below threshold
                return currentPrice <= order.targetPrice;
            case 'TAKE_PROFIT':
                // SELL order triggered when price rises above threshold
                return currentPrice >= order.targetPrice;
            default:
                return false;
        }
    }

    private async executeOrder(order: LimitOrder, executionPrice: number): Promise<boolean> {
        console.log(`[TradeMonitor] Executing ${order.type} for ${order.symbol} @ ${executionPrice} (Target: ${order.targetPrice})`);
        
        try {
            // 1. Fetch user's portfolio
            const portfolios = await this.infra.portfolio.findByUserId(order.userId);
            if (!portfolios.length) return false;
            const portfolio = portfolios[0];

            // 2. Perform the trade logic
            if (order.type === 'BUY') {
                const totalCost = order.quantity * executionPrice;
                if (portfolio.cashBalance < totalCost) {
                    await this.infra.limitOrder.updateStatus(order.id, 'EXPIRED'); // Or 'FAILED_FUNDS'
                    return false;
                }
                
                await this.infra.portfolio.executeTrade(
                    portfolio.id,
                    order.symbol,
                    order.quantity,
                    executionPrice,
                    'BUY'
                );
            } else {
                // SELL, STOP_LOSS, TAKE_PROFIT all act as SELLs
                const holding = portfolio.holdings.find(h => h.symbol === order.symbol);
                if (!holding || holding.quantity < order.quantity) {
                    await this.infra.limitOrder.updateStatus(order.id, 'EXPIRED');
                    return false;
                }

                await this.infra.portfolio.executeTrade(
                    portfolio.id,
                    order.symbol,
                    order.quantity,
                    executionPrice,
                    'SELL'
                );
            }

            // 3. Update order status
            await this.infra.limitOrder.updateStatus(order.id, 'EXECUTED', executionPrice);

            // 4. Notify user
            const notificationService = new NotificationService(this.infra.notification);
            await notificationService.notifySignal(order.userId, {
                symbol: order.symbol,
                type: 'ORDER_EXECUTED',
                strength: 'MEDIUM',
                description: `Simulated ${order.type} order executed for ${order.quantity} shares of ${order.symbol} at ₹${executionPrice.toFixed(2)}.`,
                timestamp: new Date()
            });

            return true;
        } catch (err) {
            console.error(`[TradeMonitor] Execution failed for order ${order.id}:`, err);
            return false;
        }
    }
}
