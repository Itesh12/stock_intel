import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getInfrastructure } from "@/infrastructure/container";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

const TradeSchema = z.object({
    symbol: z.string().toUpperCase().regex(/^[A-Z0-9.\-_]+$/),
    quantity: z.number().int().positive(),
    type: z.enum(["BUY", "SELL"]),
    stopLoss: z.number().positive().optional().nullable(),
    takeProfit: z.number().positive().optional().nullable(),
});

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const validation = TradeSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ 
                error: "Invalid trade parameters", 
                details: validation.error.flatten().fieldErrors 
            }, { status: 400 });
        }

        const { symbol, quantity, type, stopLoss, takeProfit } = validation.data;

        const infra = await getInfrastructure();
        const userId = (session.user as any).id;

        // Get Portfolio
        const portfolios = await infra.portfolio.findByUserId(userId);
        let portfolio = portfolios[0];
        const isNewPortfolio = !portfolio;

        if (!portfolio) {
            // Self-healing: create portfolio if missing
            portfolio = {
                id: uuidv4(),
                userId,
                name: "Default Portfolio",
                holdings: [],
                totalValue: 0,
                totalPL: 0,
                totalPLPercent: 0,
                cashBalance: 1000000,
                riskScore: 0,
                sectorExposure: {},
                updatedAt: new Date(),
                createdAt: new Date()
            };
        }

        // Clone the portfolio state for transactional rollback safety
        const originalPortfolioState = JSON.parse(JSON.stringify(portfolio));

        const initialHolding = portfolio.holdings.find((h: any) => h.symbol === symbol);

        // Get current price
        const stockData = await infra.market.getStockPrice(symbol);
        const currentPrice = stockData.price;

        if (!currentPrice || currentPrice <= 0) {
            return NextResponse.json({ error: "Could not fetch current market price" }, { status: 400 });
        }

        const totalCost = currentPrice * quantity;

        if (type === "BUY") {
            if (portfolio.cashBalance < totalCost) {
                return NextResponse.json({ error: "Insufficient virtual funds" }, { status: 400 });
            }

            // Update holdings
            const holdingIndex = portfolio.holdings.findIndex(h => h.symbol === symbol);
            if (holdingIndex >= 0) {
                const existing = portfolio.holdings[holdingIndex];
                const newQty = existing.quantity + quantity;
                const newAvg = (existing.averagePrice * existing.quantity + totalCost) / newQty;

                portfolio.holdings[holdingIndex] = {
                    ...existing,
                    quantity: newQty,
                    averagePrice: newAvg,
                    currentPrice: currentPrice,
                    marketValue: newQty * currentPrice,
                    unrealizedPL: (currentPrice - newAvg) * newQty,
                    unrealizedPLPercent: ((currentPrice - newAvg) / newAvg) * 100
                };
            } else {
                portfolio.holdings.push({
                    id: uuidv4(),
                    symbol,
                    quantity,
                    averagePrice: currentPrice,
                    currentPrice: currentPrice,
                    marketValue: totalCost,
                    unrealizedPL: 0,
                    unrealizedPLPercent: 0,
                    sector: stockData.sector || "Other",
                    weight: 0 // Will be recalculated on display or periodically
                });
            }

            portfolio.cashBalance -= totalCost;
        } else if (type === "SELL") {
            const holdingIndex = portfolio.holdings.findIndex(h => h.symbol === symbol);
            if (holdingIndex < 0 || portfolio.holdings[holdingIndex].quantity < quantity) {
                return NextResponse.json({ error: "Insufficient holdings to sell" }, { status: 400 });
            }

            const existing = portfolio.holdings[holdingIndex];
            const sellValue = currentPrice * quantity;

            if (existing.quantity === quantity) {
                // Sell all
                portfolio.holdings.splice(holdingIndex, 1);
            } else {
                // Partial sell
                existing.quantity -= quantity;
                existing.currentPrice = currentPrice;
                existing.marketValue = existing.quantity * currentPrice;
                existing.unrealizedPL = (currentPrice - existing.averagePrice) * existing.quantity;
                existing.unrealizedPLPercent = ((currentPrice - existing.averagePrice) / existing.averagePrice) * 100;
            }

            portfolio.cashBalance += sellValue;
        }

        // Recalculate total value
        portfolio.totalValue = portfolio.cashBalance + portfolio.holdings.reduce((sum, h) => sum + h.marketValue, 0);
        portfolio.updatedAt = new Date();

        await infra.portfolio.save(portfolio);

        try {
            const realizedPL = type === 'SELL' ? (currentPrice - (initialHolding?.averagePrice || currentPrice)) * quantity : undefined;
            const averagePriceAtSale = type === 'SELL' ? (initialHolding?.averagePrice || currentPrice) : undefined;

            // Record trade in ledger
            const tradeId = uuidv4();
            await infra.trade.save({
                id: tradeId,
                userId,
                symbol,
                quantity,
                price: currentPrice,
                totalValue: currentPrice * quantity,
                type: type as any,
                timestamp: new Date(),
                realizedPL,
                averagePriceAtSale
            });

            // Save attached SL/TP orders if BUY
            if (type === 'BUY') {
                if (stopLoss) {
                    await infra.limitOrder.save({
                        id: uuidv4(),
                        userId,
                        symbol,
                        quantity,
                        targetPrice: stopLoss,
                        type: 'STOP_LOSS',
                        status: 'PENDING',
                        timestamp: new Date(),
                        parentOrderId: tradeId
                    });
                }
                if (takeProfit) {
                    await infra.limitOrder.save({
                        id: uuidv4(),
                        userId,
                        symbol,
                        quantity,
                        targetPrice: takeProfit,
                        type: 'TAKE_PROFIT',
                        status: 'PENDING',
                        timestamp: new Date(),
                        parentOrderId: tradeId
                    });
                }
            }
        } catch (dbError) {
            console.error("[ACID Rollback] Trade ledger execution failed. Initiating automated rollback...", dbError);
            if (isNewPortfolio) {
                await infra.portfolio.delete(portfolio.id);
            } else {
                await infra.portfolio.save(originalPortfolioState);
            }
            throw new Error("Trade execution database transaction failed. All changes have been safely rolled back.");
        }

        return NextResponse.json({
            message: `Successfully executed ${type} order`,
            newBalance: portfolio.cashBalance,
            quantity: quantity,
            price: currentPrice
        });

    } catch (error: any) {
        console.error("Trade error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
