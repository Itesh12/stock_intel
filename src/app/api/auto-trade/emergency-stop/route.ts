import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getInfrastructure } from "@/infrastructure/container";
import { globalEvents } from "@/infrastructure/events";
import { v4 as uuidv4 } from "uuid";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = (session.user as any).id;
        const infra = await getInfrastructure();
        const body = await req.json().catch(() => ({}));
        const flattenPositions = body.flattenPositions === true;

        const sessionDb = infra.mongoClient ? infra.mongoClient.startSession() : null;
        let success = false;
        let pausedCount = 0;
        let cancelledCount = 0;
        let liquidatedCount = 0;

        const emergencyStopTransaction = async (sess?: any) => {
            // 1. Fetch user portfolio
            const portfolios = await infra.portfolio.findByUserId(userId, sess);
            if (portfolios.length === 0) throw new Error("Portfolio not found");
            const portfolio = portfolios[0];

            // 2. Fetch and pause all active bots for this user
            const bots = await infra.autoTradeBot.findByUserId(userId);
            const activeBots = bots.filter(b => b.status === 'ACTIVE');
            
            for (const bot of activeBots) {
                // If flattening positions, we'll release everything, otherwise release non-deployed portion
                let releasableCash = bot.allocatedCash - bot.deployedCash;
                if (flattenPositions) {
                    releasableCash = bot.allocatedCash; // release all allocated cash
                    bot.deployedCash = 0;
                }
                
                portfolio.reservedCash = Math.max(0, (portfolio.reservedCash || 0) - releasableCash);
                bot.status = 'PAUSED';
                bot.updatedAt = new Date();

                await infra.autoTradeBot.save(bot);
                pausedCount++;

                // Write emergency halt log
                await infra.autoTradeLog.save({
                    id: "",
                    botId: bot.id,
                    timestamp: new Date(),
                    level: "ERROR",
                    category: "SYSTEM",
                    message: `🚨 Emergency Stop triggered! Bot paused ${flattenPositions ? 'and positions flattened' : 'gracefully'}.`,
                    createdAt: new Date()
                });
                globalEvents.emitLog(bot.id, "ERROR", "SYSTEM", "🚨 Emergency Halt: Bot paused via global kill switch.");
            }

            // 3. Cancel all pending limit orders (BUY, STOP_LOSS, TAKE_PROFIT) placed by the user's bots
            const pendingOrders = await infra.limitOrder.findPending();
            const userBotPending = pendingOrders.filter(o => o.userId === userId && o.botId);

            for (const order of userBotPending) {
                await infra.limitOrder.updateStatus(order.id, 'CANCELLED', undefined, sess);
                cancelledCount++;
            }

            // 4. Flatten positions if confirmed by the client
            if (flattenPositions && portfolio.holdings.length > 0) {
                // Clone holdings array to safely iterate during execution
                const currentHoldings = [...portfolio.holdings];
                
                for (const holding of currentHoldings) {
                    // Fetch latest market price to liquidate at current market rates
                    const stockData = await infra.market.getStockPrice(holding.symbol);
                    const currentPrice = stockData?.price || holding.currentPrice;
                    const positionCost = holding.quantity * holding.averagePrice;
                    const totalValue = holding.quantity * currentPrice;
                    const realizedPL = totalValue - positionCost;

                    // Execute SELL in portfolio
                    await infra.portfolio.executeTrade(
                        portfolio.id,
                        holding.symbol,
                        holding.quantity,
                        currentPrice,
                        'SELL',
                        sess
                    );

                    // Save trade ledger
                    await infra.trade.save({
                        id: uuidv4(),
                        userId,
                        symbol: holding.symbol,
                        quantity: holding.quantity,
                        price: currentPrice,
                        totalValue,
                        type: 'SELL',
                        source: 'limit_order', // treat as limit/market order
                        timestamp: new Date(),
                        realizedPL,
                        averagePriceAtSale: holding.averagePrice
                    }, sess);

                    liquidatedCount++;
                }

                // Fully clear reservedCash since all positions are liquidated
                portfolio.reservedCash = 0;
            }

            // Save portfolio updates
            await infra.portfolio.save(portfolio, sess);
        };

        try {
            if (sessionDb) {
                await sessionDb.withTransaction(async () => {
                    await emergencyStopTransaction(sessionDb);
                });
            } else {
                await emergencyStopTransaction();
            }
            success = true;
        } catch (txnErr: any) {
            console.error("Emergency stop transaction failed:", txnErr);
            return NextResponse.json({ error: txnErr.message || "Emergency halt failed." }, { status: 400 });
        } finally {
            if (sessionDb) {
                await sessionDb.endSession();
            }
        }

        return NextResponse.json({
            message: "Emergency stop executed successfully",
            pausedCount,
            cancelledCount,
            liquidatedCount,
            flattened: flattenPositions
        });
    } catch (error: any) {
        console.error("Emergency stop error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
