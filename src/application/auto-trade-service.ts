import { Infrastructure } from "../infrastructure/container";
import { AutoTradeBot } from "../domain/auto-trade-bot";
import { LimitOrder } from "../domain/limit-order";
import { NotificationService } from "./notification-service";
import { v4 as uuidv4 } from "uuid";

// IST market hours: 9:30 AM - 2:30 PM
const MARKET_OPEN_HOUR = 9;
const MARKET_OPEN_MIN = 30;
const MARKET_CLOSE_HOUR = 14;
const MARKET_CLOSE_MIN = 30;

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

export class AutoTradeService {
    private notificationService: NotificationService;

    constructor(private infra: Infrastructure) {
        this.notificationService = new NotificationService(infra.notification);
    }

    async runAllBots(): Promise<void> {
        const bots = await this.infra.autoTradeBot.findAllActive();
        if (bots.length === 0) return;

        for (const bot of bots) {
            try {
                await this.runBot(bot);
            } catch (err) {
                console.error(`[AutoTrade] Bot ${bot.id} (${bot.name}) failed:`, err);
            }
        }
    }

    private async runBot(bot: AutoTradeBot): Promise<void> {
        // 1. Daily trade count reset
        const today = todayStr();
        if (bot.todayDate !== today) {
            await this.infra.autoTradeBot.updateStats(bot.id, { todayTradeCount: 0, todayDate: today });
            bot.todayTradeCount = 0;
            bot.todayDate = today;
        }

        // 2. Daily cap guard
        if (bot.todayTradeCount >= bot.maxTradesPerDay) {
            return;
        }

        // 3. Market hours guard (only enforce for intraday strategy)
        if (bot.strategySlug === 'intraday-strategy' && !isMarketOpen()) {
            return;
        }

        // 4. Fetch scanner recommendations for this strategy
        const strategy = await this.infra.strategy.findBySlug(bot.strategySlug);
        if (!strategy) return;

        const recommendations = await this.infra.strategy.getRecommendations(strategy.id);
        if (recommendations.length === 0) return;

        // 5. Filter by bot's minimum confluence score
        const qualifiedRecs = recommendations.filter(r => r.score >= bot.minConfluenceScore);
        if (qualifiedRecs.length === 0) return;

        // 6. Get user portfolio
        const portfolios = await this.infra.portfolio.findByUserId(bot.userId);
        if (!portfolios.length) return;
        const portfolio = portfolios[0];

        // 7. Try each qualified recommendation until we find one we can trade
        for (const rec of qualifiedRecs) {
            if (bot.todayTradeCount >= bot.maxTradesPerDay) break;

            const symbol = rec.symbol;

            // Guard: Already holding this symbol?
            const alreadyHolding = portfolio.holdings.find(h => h.symbol === symbol);
            if (alreadyHolding) continue;

            // Guard: Already have a pending BUY for this symbol from this bot?
            const pendingBotOrders = await this.infra.limitOrder.findPendingBySymbol(symbol);
            const hasPendingBotBuy = pendingBotOrders.some(o => o.botId === bot.id && o.type === 'BUY');
            if (hasPendingBotBuy) continue;

            // Get current price
            let currentPrice: number;
            try {
                const stockData = await this.infra.market.getStockPrice(symbol);
                if (!stockData || !stockData.price || stockData.price <= 0) continue;
                currentPrice = stockData.price;
            } catch {
                continue;
            }

            // Calculate position size
            const maxPositionValue = bot.capitalAllocated * (bot.maxPositionSizePercent / 100);
            const availableCash = Math.min(portfolio.cashBalance, maxPositionValue);
            if (availableCash < currentPrice) continue; // Can't afford even 1 share

            const quantity = Math.floor(availableCash / currentPrice);
            if (quantity <= 0) continue;

            const positionCost = quantity * currentPrice;

            // Guard: Portfolio cash check
            if (portfolio.cashBalance < positionCost) continue;

            // 8. Execute the BUY immediately (market price)
            try {
                await this.infra.portfolio.executeTrade(portfolio.id, symbol, quantity, currentPrice, 'BUY');

                // 9. Record the trade in trade history
                const tradeId = uuidv4();
                await this.infra.trade.save({
                    id: tradeId,
                    userId: bot.userId,
                    symbol,
                    quantity,
                    price: currentPrice,
                    totalValue: positionCost,
                    type: 'BUY',
                    timestamp: new Date(),
                    botId: bot.id,
                });

                // 10. Place Stop-Loss order
                const slPrice = parseFloat((currentPrice * (1 - bot.stopLossPercent / 100)).toFixed(2));
                const slOrder: LimitOrder = {
                    id: uuidv4(),
                    userId: bot.userId,
                    symbol,
                    quantity,
                    targetPrice: slPrice,
                    type: 'STOP_LOSS',
                    status: 'PENDING',
                    timestamp: new Date(),
                    strategyId: strategy.id,
                    botId: bot.id,
                };
                await this.infra.limitOrder.save(slOrder);

                // 11. Place Take-Profit order
                const tpPrice = parseFloat((currentPrice * (1 + bot.takeProfitPercent / 100)).toFixed(2));
                const tpOrder: LimitOrder = {
                    id: uuidv4(),
                    userId: bot.userId,
                    symbol,
                    quantity,
                    targetPrice: tpPrice,
                    type: 'TAKE_PROFIT',
                    status: 'PENDING',
                    timestamp: new Date(),
                    strategyId: strategy.id,
                    parentOrderId: slOrder.id,
                    botId: bot.id,
                };
                await this.infra.limitOrder.save(tpOrder);

                // 12. Update bot stats
                const newTodayCount = bot.todayTradeCount + 1;
                const newTotal = bot.totalTradesExecuted + 1;
                await this.infra.autoTradeBot.updateStats(bot.id, {
                    todayTradeCount: newTodayCount,
                    totalTradesExecuted: newTotal,
                    todayDate: today,
                });
                bot.todayTradeCount = newTodayCount;

                // 13. Notify user
                await this.notificationService.notifySignal(bot.userId, {
                    symbol,
                    type: 'ORDER_EXECUTED',
                    strength: 'HIGH',
                    description: `🤖 Auto-Trade [${bot.name}]: Bought ${quantity} shares of ${symbol.replace('.NS', '')} @ ₹${currentPrice.toFixed(2)}. SL: ₹${slPrice} | TP: ₹${tpPrice}`,
                    timestamp: new Date(),
                });

                console.log(`[AutoTrade] Bot "${bot.name}" bought ${quantity}x ${symbol} @ ₹${currentPrice}`);

                // Refresh portfolio for next iteration
                const updatedPortfolios = await this.infra.portfolio.findByUserId(bot.userId);
                if (updatedPortfolios.length) {
                    portfolio.cashBalance = updatedPortfolios[0].cashBalance;
                    portfolio.holdings = updatedPortfolios[0].holdings;
                }

            } catch (err: any) {
                console.error(`[AutoTrade] Trade failed for ${symbol}:`, err?.message || err);
            }
        }
    }
}
