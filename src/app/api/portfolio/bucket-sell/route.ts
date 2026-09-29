import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getInfrastructure } from "@/infrastructure/container";
import { v4 as uuidv4 } from "uuid";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { orders, sellAll } = body;

        const infra = await getInfrastructure();
        const userId = (session.user as any).id;

        const portfolios = await infra.portfolio.findByUserId(userId);
        const portfolio = portfolios[0];

        if (!portfolio) {
            return NextResponse.json({ error: "Portfolio not found. Please create or reset your portfolio." }, { status: 404 });
        }

        if (!portfolio.holdings || portfolio.holdings.length === 0) {
            return NextResponse.json({ error: "No active stock holdings found in your portfolio to sell." }, { status: 400 });
        }

        // Determine list of orders to process
        let targetOrders: Array<{ symbol: string; quantity: number; price?: number; name?: string }> = [];

        if (Array.isArray(orders) && orders.length > 0) {
            targetOrders = orders.filter((o: any) => typeof o.symbol === "string" && o.quantity > 0);
        } else if (sellAll === true) {
            // Liquidate 100% of all holdings
            targetOrders = portfolio.holdings.map((h: any) => ({
                symbol: h.symbol,
                quantity: h.quantity,
                price: h.currentPrice || h.averagePrice,
                name: (h as any).name || h.symbol
            }));
        }

        if (targetOrders.length === 0) {
            return NextResponse.json({ error: "No valid stocks with quantity > 0 selected for sale." }, { status: 400 });
        }

        const executedTrades: any[] = [];
        const skippedSymbols: any[] = [];
        let totalProceeds = 0;
        let totalRealizedPL = 0;

        for (const order of targetOrders) {
            const currentHolding = portfolio.holdings.find(h => h.symbol === order.symbol);
            if (!currentHolding || currentHolding.quantity <= 0) {
                skippedSymbols.push({
                    symbol: order.symbol,
                    reason: "Holding not found or zero shares owned"
                });
                continue;
            }

            const quantityToSell = Math.min(order.quantity, currentHolding.quantity);
            if (quantityToSell <= 0) continue;

            // Determine execution price
            let executionPrice = order.price && order.price > 0 ? order.price : currentHolding.currentPrice;
            if (!executionPrice || executionPrice <= 0) {
                try {
                    const quote = await infra.market.getStockPrice(order.symbol);
                    executionPrice = quote.price || currentHolding.averagePrice;
                } catch {
                    executionPrice = currentHolding.averagePrice;
                }
            }

            const tradeValue = quantityToSell * executionPrice;
            const realizedPL = (executionPrice - currentHolding.averagePrice) * quantityToSell;

            try {
                // Execute trade on portfolio repo
                await infra.portfolio.executeTrade(
                    portfolio.id,
                    order.symbol,
                    quantityToSell,
                    executionPrice,
                    'SELL'
                );

                // Record in trade history ledger
                try {
                    await infra.trade.save({
                        id: uuidv4(),
                        userId,
                        symbol: order.symbol,
                        quantity: quantityToSell,
                        price: executionPrice,
                        totalValue: tradeValue,
                        type: 'SELL',
                        source: 'manual',
                        timestamp: new Date(),
                        realizedPL,
                        averagePriceAtSale: currentHolding.averagePrice
                    });
                } catch (ledgerErr) {
                    console.warn(`Failed to write ledger trade for ${order.symbol}:`, ledgerErr);
                }

                totalProceeds += tradeValue;
                totalRealizedPL += realizedPL;

                executedTrades.push({
                    symbol: order.symbol,
                    name: order.name || (currentHolding as any).name || order.symbol,
                    quantity: quantityToSell,
                    price: executionPrice,
                    totalValue: tradeValue,
                    realizedPL
                });
            } catch (err: any) {
                console.error(`Failed to sell ${order.symbol}:`, err);
                skippedSymbols.push({
                    symbol: order.symbol,
                    reason: err.message || "Execution error"
                });
            }
        }

        // Fetch refreshed portfolio for accurate current cash
        const refreshedPortfolios = await infra.portfolio.findByUserId(userId);
        const finalPortfolio = refreshedPortfolios[0];

        return NextResponse.json({
            success: true,
            message: `Successfully executed sale of ${executedTrades.length} stock positions.`,
            totalProceeds,
            totalRealizedPL,
            remainingCash: finalPortfolio ? finalPortfolio.cashBalance : (portfolio.cashBalance + totalProceeds),
            executedCount: executedTrades.length,
            executedTrades,
            skippedSymbols
        });

    } catch (err: any) {
        console.error("Bucket sell API error:", err);
        return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
    }
}
