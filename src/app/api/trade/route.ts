import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getInfrastructure } from "@/infrastructure/container";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

const TradeSchema = z.object({
    symbol: z.string().toUpperCase().regex(/^[A-Z0-9\-_]+\.NS$/),
    quantity: z.number().int().positive(),
    type: z.enum(["BUY", "SELL"]),
    stopLoss: z.number().positive().optional().nullable(),
    takeProfit: z.number().positive().optional().nullable(),
    idempotencyKey: z.string().optional().nullable(),
});

class TradeValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "TradeValidationError";
    }
}

export async function POST(req: Request) {
    let idempotencyKey: string | null = null;
    let idempotencyCollection: any = null;

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
        idempotencyKey = validation.data.idempotencyKey || null;

        const infra = await getInfrastructure();
        const userId = (session.user as any).id;

        // Set up idempotency keys collection
        const db = infra.mongoClient ? infra.mongoClient.db(process.env.MONGO_DB || "market") : null;
        if (db) {
            idempotencyCollection = db.collection("idempotency_keys");
            await idempotencyCollection.createIndex({ key: 1 }, { unique: true }).catch(() => {});
            await idempotencyCollection.createIndex({ createdAt: 1 }, { expireAfterSeconds: 86400 }).catch(() => {});
        }

        // Idempotency check
        if (idempotencyKey && idempotencyCollection) {
            const existing = await idempotencyCollection.findOne({ key: idempotencyKey });
            if (existing) {
                if (existing.status === "COMPLETED") {
                    return NextResponse.json(existing.response);
                } else if (existing.status === "PROCESSING") {
                    return NextResponse.json({ error: "Trade is currently being processed. Please retry." }, { status: 409 });
                } else {
                    // Failed attempt, remove so we can retry
                    await idempotencyCollection.deleteOne({ key: idempotencyKey });
                }
            }

            try {
                await idempotencyCollection.insertOne({
                    key: idempotencyKey,
                    status: "PROCESSING",
                    createdAt: new Date(),
                });
            } catch (dupError) {
                return NextResponse.json({ error: "Duplicate request in progress." }, { status: 409 });
            }
        }

        // Fetch stock price (outside retry loop to minimize external network requests)
        const stockData = await infra.market.getStockPrice(symbol);
        const currentPrice = stockData.price;

        if (!currentPrice || currentPrice <= 0) {
            if (idempotencyKey && idempotencyCollection) {
                await idempotencyCollection.deleteOne({ key: idempotencyKey }).catch(() => {});
            }
            return NextResponse.json({ error: "Could not fetch current market price" }, { status: 400 });
        }

        const totalCost = currentPrice * quantity;
        const MAX_ATTEMPTS = 3;
        let attempt = 0;
        let success = false;
        let responseJson: any = null;

        while (attempt < MAX_ATTEMPTS && !success) {
            attempt++;
            const txSession = infra.mongoClient ? infra.mongoClient.startSession() : null;
            try {
                const executeTradeInTransaction = async (session?: any) => {
                    // 1. Reload latest portfolio to ensure we have the correct version
                    const portfolios = await infra.portfolio.findByUserId(userId, session);
                    let portfolio = portfolios[0];

                    if (!portfolio) {
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

                    const initialHolding = portfolio.holdings.find((h: any) => h.symbol === symbol);

                    // Check balance/holdings constraints
                    if (type === "BUY") {
                        if (portfolio.cashBalance < totalCost) {
                            throw new TradeValidationError("Insufficient virtual funds");
                        }

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
                                weight: 0
                            });
                        }
                        portfolio.cashBalance -= totalCost;
                    } else if (type === "SELL") {
                        const holdingIndex = portfolio.holdings.findIndex(h => h.symbol === symbol);
                        if (holdingIndex < 0 || portfolio.holdings[holdingIndex].quantity < quantity) {
                            throw new TradeValidationError("Insufficient holdings to sell");
                        }

                        const existing = portfolio.holdings[holdingIndex];
                        const sellValue = currentPrice * quantity;

                        if (existing.quantity === quantity) {
                            portfolio.holdings.splice(holdingIndex, 1);
                        } else {
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

                    // Save portfolio
                    await infra.portfolio.save(portfolio, session);

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
                        source: "manual", // Execution source tracking
                        timestamp: new Date(),
                        realizedPL,
                        averagePriceAtSale
                    }, session);

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
                            }, session);
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
                            }, session);
                        }
                    }

                    responseJson = {
                        message: `Successfully executed ${type} order`,
                        newBalance: portfolio.cashBalance,
                        quantity: quantity,
                        price: currentPrice
                    };
                };

                if (txSession) {
                    await txSession.withTransaction(async () => {
                        await executeTradeInTransaction(txSession);
                    });
                } else {
                    await executeTradeInTransaction();
                }
                success = true;
            } catch (err: any) {
                if (txSession && txSession.inTransaction()) {
                    await txSession.abortTransaction().catch(() => {});
                }

                if (err instanceof TradeValidationError) {
                    if (idempotencyKey && idempotencyCollection) {
                        await idempotencyCollection.deleteOne({ key: idempotencyKey }).catch(() => {});
                    }
                    return NextResponse.json({ error: err.message }, { status: 400 });
                }

                const isVersionConflict = err.message?.includes("VersionConflictError");
                if (isVersionConflict && attempt < MAX_ATTEMPTS) {
                    console.warn(`[TradeAPI] VersionConflictError on attempt ${attempt}. Retrying trade...`);
                    await new Promise(resolve => setTimeout(resolve, attempt * 50));
                    continue;
                }

                throw err; // rethrow other errors
            } finally {
                if (txSession) {
                    await txSession.endSession();
                }
            }
        }

        if (success) {
            const { CacheUtils } = require("@/infrastructure/cache-utils");
            CacheUtils.delete(`portfolio_analytics_${userId}`);
        }

        if (success && idempotencyKey && idempotencyCollection && responseJson) {
            await idempotencyCollection.updateOne(
                { key: idempotencyKey },
                { $set: { status: "COMPLETED", response: responseJson, completedAt: new Date() } }
            ).catch((err: any) => console.error("Failed to update idempotency key status:", err));
        }

        return NextResponse.json(responseJson);

    } catch (error: any) {
        console.error("Trade error:", error);
        if (idempotencyKey && idempotencyCollection) {
            await idempotencyCollection.updateOne(
                { key: idempotencyKey },
                { $set: { status: "FAILED", failedAt: new Date() } }
            ).catch(() => {});
        }
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
