import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getInfrastructure } from "@/infrastructure/container";
import { v4 as uuidv4 } from "uuid";

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const infra = await getInfrastructure();
        const userId = (session.user as any).id;

        const portfolios = await infra.portfolio.findByUserId(userId);
        const portfolio = portfolios[0] || null;

        if (portfolio) {
            if (portfolio.holdings.length > 0) {
                // Refresh current prices and get performance for Day P/L calculation
                const symbols = portfolio.holdings.map(h => h.symbol);

                const performanceResults = await Promise.all(
                    symbols.map(s => infra.market.getPerformance(s, "1d").catch(() => null))
                );

                let totalHoldingsValue = 0;
                let totalDayChange = 0;
                const sectorValues: Record<string, number> = {};

                portfolio.holdings.forEach((holding, i) => {
                    const perf = performanceResults[i];
                    if (perf) {
                        holding.currentPrice = perf.currentPrice;
                        holding.marketValue = holding.quantity * perf.currentPrice;
                        holding.unrealizedPL = (perf.currentPrice - holding.averagePrice) * holding.quantity;
                        holding.unrealizedPLPercent = ((perf.currentPrice - holding.averagePrice) / holding.averagePrice) * 100;

                        // Day P/L calculation (relative to yesterday close)
                        holding.dayChange = perf.change * holding.quantity;
                        holding.dayChangePercent = perf.changePercent;
                        holding.sector = perf.sector || holding.sector || "Other";

                        totalDayChange += holding.dayChange;

                        const sector = holding.sector || "Other";
                        sectorValues[sector] = (sectorValues[sector] || 0) + holding.marketValue;
                    }
                    totalHoldingsValue += holding.marketValue || 0;
                });

                portfolio.totalValue = portfolio.cashBalance + totalHoldingsValue;

                // Calculate Sector Exposure Percentages
                portfolio.sectorExposure = {};
                if (totalHoldingsValue > 0) {
                    for (const sector in sectorValues) {
                        portfolio.sectorExposure[sector] = (sectorValues[sector] / totalHoldingsValue) * 100;
                    }
                }

                portfolio.totalPL = portfolio.holdings.reduce((sum, h) => sum + (h.unrealizedPL || 0), 0);

                portfolio.dayPnL = totalDayChange;
                portfolio.dayPnLPercent = portfolio.totalValue > 0 ? (totalDayChange / (portfolio.totalValue - totalDayChange)) * 100 : 0;

                const totalInvested = portfolio.holdings.reduce((sum, h) => sum + (h.averagePrice * h.quantity), 0);
                portfolio.totalPLPercent = totalInvested > 0 ? (portfolio.totalPL / totalInvested) * 100 : 0;

                portfolio.updatedAt = new Date();
                await infra.portfolio.save(portfolio);

                // Snapshot Logic: Save a snapshot if the latest one is from a different day
                try {
                    const latestSnapshot = await infra.analytics.getLatestSnapshot(userId);
                    const now = new Date();
                    const todayStr = now.toISOString().split('T')[0];
                    const latestStr = latestSnapshot ? latestSnapshot.timestamp.toISOString().split('T')[0] : '';

                    if (todayStr !== latestStr) {
                        await infra.analytics.saveSnapshot({
                            id: '',
                            userId,
                            nav: portfolio.totalValue,
                            cash: portfolio.cashBalance,
                            holdingsValue: totalHoldingsValue,
                            timestamp: now
                        });
                    }
                } catch (snapErr) {
                    console.error("Failed to save daily snapshot:", snapErr);
                }

                // Limit Order Execution Engine (Simulation on fetch)
                try {
                    const pendingOrders = await infra.limitOrder.findByUserId(userId);
                    const activePending = pendingOrders.filter(o => o.status === 'PENDING');

                    if (activePending.length > 0) {
                        const uniqueSymbols = Array.from(new Set(activePending.map(o => o.symbol)));
                        const pricesMap: Record<string, number> = {};

                        // Fetch all unique prices in parallel for efficiency
                        await Promise.all(uniqueSymbols.map(async (sym) => {
                            const stockPerf = await infra.market.getStockPrice(sym).catch(() => null);
                            if (stockPerf?.price) pricesMap[sym] = stockPerf.price;
                        }));

                        for (const order of activePending) {
                            const currentPrice = pricesMap[order.symbol];
                            if (!currentPrice) continue;

                            let shouldExecute = false;
                            if (order.type === 'BUY' && currentPrice <= order.targetPrice) shouldExecute = true;
                            if (order.type === 'SELL' && currentPrice >= order.targetPrice) shouldExecute = true;

                            if (shouldExecute) {
                                // Execute Order
                                const totalValue = currentPrice * order.quantity;

                                // Update Portfolio
                                const p = (await infra.portfolio.findByUserId(userId))[0];
                                if (order.type === 'BUY') {
                                    if (p.cashBalance >= totalValue) {
                                        p.cashBalance -= totalValue;
                                        const hIndex = p.holdings.findIndex(sh => sh.symbol === order.symbol);
                                        if (hIndex >= 0) {
                                            const h = p.holdings[hIndex];
                                            const newQty = h.quantity + order.quantity;
                                            h.averagePrice = (h.averagePrice * h.quantity + totalValue) / newQty;
                                            h.quantity = newQty;
                                            h.marketValue = newQty * currentPrice;
                                        } else {
                                            p.holdings.push({
                                                id: uuidv4(),
                                                symbol: order.symbol,
                                                quantity: order.quantity,
                                                averagePrice: currentPrice,
                                                currentPrice,
                                                marketValue: totalValue,
                                                unrealizedPL: 0,
                                                unrealizedPLPercent: 0,
                                                sector: "Other",
                                                weight: 0
                                            });
                                        }
                                    }
                                } else {
                                    const hIndex = p.holdings.findIndex(sh => sh.symbol === order.symbol);
                                    if (hIndex >= 0 && p.holdings[hIndex].quantity >= order.quantity) {
                                        const h = p.holdings[hIndex];
                                        p.cashBalance += totalValue;
                                        if (h.quantity === order.quantity) {
                                            p.holdings.splice(hIndex, 1);
                                        } else {
                                            h.quantity -= order.quantity;
                                            h.marketValue = h.quantity * currentPrice;
                                        }
                                    }
                                }

                                await infra.portfolio.save(p);
                                await infra.limitOrder.updateStatus(order.id, 'EXECUTED', currentPrice);

                                // Log to Trade History
                                await infra.trade.save({
                                    id: uuidv4(),
                                    userId,
                                    symbol: order.symbol,
                                    quantity: order.quantity,
                                    price: currentPrice,
                                    totalValue,
                                    type: order.type,
                                    timestamp: new Date()
                                });
                            }
                        }
                    }
                } catch (limitErr) {
                    console.error("Limit engine failed", limitErr);
                }
            }
            return NextResponse.json(portfolio);
        }

        return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
    } catch (error: any) {
        console.error("Portfolio fetch error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
