import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getInfrastructure } from "@/infrastructure/container";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { orders, symbols } = body;

        const infra = await getInfrastructure();
        const userId = (session.user as any).id;

        const portfolios = await infra.portfolio.findByUserId(userId);
        const portfolio = portfolios[0];

        if (!portfolio) {
            return NextResponse.json({ error: "Portfolio not found. Please create or reset your portfolio." }, { status: 404 });
        }

        const availableCash = portfolio.cashBalance;
        if (availableCash <= 0) {
            return NextResponse.json({ error: "Insufficient wallet balance. Cash balance is ₹0." }, { status: 400 });
        }

        // MODE 1: Itemized custom orders payload [{ symbol, quantity, price, name }]
        if (Array.isArray(orders) && orders.length > 0) {
            const validOrders = orders.filter((o: any) => typeof o.symbol === "string" && o.quantity > 0 && o.price > 0);

            if (validOrders.length === 0) {
                return NextResponse.json({ error: "No valid stock orders with quantity > 0 specified." }, { status: 400 });
            }

            const totalRequiredCost = validOrders.reduce((sum: number, o: any) => sum + o.quantity * o.price, 0);

            if (totalRequiredCost > availableCash) {
                return NextResponse.json({
                    error: `Required investment (₹${totalRequiredCost.toLocaleString('en-IN')}) exceeds available wallet cash (₹${availableCash.toLocaleString('en-IN')}).`
                }, { status: 400 });
            }

            const executedTrades: any[] = [];
            const skippedSymbols: any[] = [];
            let totalCapitalSpent = 0;

            for (const order of validOrders) {
                const totalCost = order.quantity * order.price;
                try {
                    await infra.portfolio.executeTrade(
                        portfolio.id,
                        order.symbol,
                        order.quantity,
                        order.price,
                        'BUY'
                    );

                    totalCapitalSpent += totalCost;
                    executedTrades.push({
                        symbol: order.symbol,
                        name: order.name || order.symbol,
                        quantity: order.quantity,
                        price: order.price,
                        totalCost
                    });
                } catch (tradeErr: any) {
                    console.error(`Trade execution failed for ${order.symbol}:`, tradeErr);
                    skippedSymbols.push({ symbol: order.symbol, reason: tradeErr.message || "Execution error" });
                }
            }

            const remainingCash = availableCash - totalCapitalSpent;

            return NextResponse.json({
                success: true,
                message: `Successfully executed bucket purchase of ${executedTrades.length} stocks.`,
                totalCapitalSpent,
                remainingCash,
                executedCount: executedTrades.length,
                executedTrades,
                skippedSymbols
            });
        }

        // MODE 2: Legacy symbols array fallback
        if (!Array.isArray(symbols) || symbols.length === 0) {
            return NextResponse.json({ error: "No stock orders or symbols provided for bucket purchase." }, { status: 400 });
        }

        const targetSymbols = symbols.slice(0, 20);

        const quoteResults = await Promise.all(
            targetSymbols.map(async (symbol) => {
                try {
                    const stock = await infra.market.getStockPrice(symbol);
                    return {
                        symbol,
                        price: stock.price || 0,
                        name: stock.name || symbol
                    };
                } catch (err) {
                    console.warn(`Failed to fetch quote for ${symbol} during bucket buy:`, err);
                    return { symbol, price: 0, name: symbol };
                }
            })
        );

        const validQuotes = quoteResults.filter(q => q.price > 0);

        if (validQuotes.length === 0) {
            return NextResponse.json({ error: "Could not retrieve live price quotes for any of the recommended stocks." }, { status: 400 });
        }

        const capitalPerStock = availableCash / validQuotes.length;

        const executedTrades: any[] = [];
        const skippedSymbols: any[] = [];
        let totalCapitalSpent = 0;

        for (const quote of validQuotes) {
            const quantity = Math.floor(capitalPerStock / quote.price);
            
            if (quantity > 0) {
                const totalCost = quantity * quote.price;
                
                try {
                    await infra.portfolio.executeTrade(
                        portfolio.id,
                        quote.symbol,
                        quantity,
                        quote.price,
                        'BUY'
                    );

                    totalCapitalSpent += totalCost;
                    executedTrades.push({
                        symbol: quote.symbol,
                        name: quote.name,
                        quantity,
                        price: quote.price,
                        totalCost
                    });
                } catch (tradeErr: any) {
                    console.error(`Trade execution failed for ${quote.symbol}:`, tradeErr);
                    skippedSymbols.push({ symbol: quote.symbol, reason: tradeErr.message || "Execution error" });
                }
            } else {
                skippedSymbols.push({
                    symbol: quote.symbol,
                    reason: `Share price (₹${quote.price.toFixed(2)}) exceeds allocated share (₹${capitalPerStock.toFixed(2)})`
                });
            }
        }

        const remainingCash = availableCash - totalCapitalSpent;

        return NextResponse.json({
            success: true,
            message: `Successfully executed bucket purchase of ${executedTrades.length} stocks.`,
            totalCapitalSpent,
            remainingCash,
            executedCount: executedTrades.length,
            executedTrades,
            skippedSymbols
        });

    } catch (err: any) {
        console.error("Bucket buy API error:", err);
        return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
    }
}
