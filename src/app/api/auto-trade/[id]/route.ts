import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getInfrastructure } from "@/infrastructure/container";
import { z } from "zod";

const BotUpdateSchema = z.object({
    name: z.string().min(1).optional(),
    status: z.enum(["ACTIVE", "PAUSED", "STOPPED"]).optional(),
    allocatedCash: z.number().positive().optional(),
    maxPositionSizePercent: z.number().min(5).max(100).optional(),
    riskPerTradePercent: z.number().min(0.5).max(10).optional(),
    maxTradesPerDay: z.number().int().positive().optional(),
    stopLossPercent: z.number().positive().optional(),
    takeProfitPercent: z.number().positive().optional(),
    minConfluenceScore: z.number().min(0).max(100).optional(),

    // Advanced Risk Controls
    maxDailyLoss: z.number().min(0).optional(),
    maxConcurrentPositions: z.number().int().min(1).max(20).optional(),
    cooldownPeriodMinutes: z.number().min(0).optional(),
    maxSectorAllocationPercent: z.number().min(5).max(100).optional(),
    drawdownProtectionPercent: z.number().min(0).max(100).optional(),
    useTrailingStop: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const body = await req.json();
        const validation = BotUpdateSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ 
                error: "Invalid update parameters", 
                details: validation.error.flatten().fieldErrors 
            }, { status: 400 });
        }

        const data = validation.data;
        const infra = await getInfrastructure();
        const userId = (session.user as any).id;

        let bot = await infra.autoTradeBot.findById(id);
        if (!bot || bot.userId !== userId) {
            return NextResponse.json({ error: "Bot not found" }, { status: 404 });
        }

        const sessionDb = infra.mongoClient ? infra.mongoClient.startSession() : null;
        let success = false;
        let finalUpdatedBot = { ...bot };

        const updateBotTransaction = async (sess?: any) => {
            const portfolios = await infra.portfolio.findByUserId(userId, sess);
            if (portfolios.length === 0) throw new Error("Portfolio not found");
            const portfolio = portfolios[0];

            let reservedCashAdjustment = 0;
            const targetStatus = data.status || bot.status;

            // 1. Handle budget limit updates
            if (data.allocatedCash !== undefined && data.allocatedCash !== bot.allocatedCash) {
                if (data.allocatedCash < bot.deployedCash) {
                    throw new Error(`Cannot reduce budget (₹${data.allocatedCash.toLocaleString()}) below active position expenditure (₹${bot.deployedCash.toLocaleString()}).`);
                }

                const cashDelta = data.allocatedCash - bot.allocatedCash;
                // If bot is active, adjust reservedCash immediately
                if (bot.status === 'ACTIVE') {
                    if (cashDelta > 0) {
                        const available = portfolio.cashBalance - (portfolio.reservedCash || 0);
                        if (available < cashDelta) {
                            throw new Error(`Insufficient funds: Budget increase of ₹${cashDelta.toLocaleString()} exceeds available virtual balance.`);
                        }
                    }
                    reservedCashAdjustment += cashDelta;
                }
                bot.allocatedCash = data.allocatedCash;
                bot.capitalAllocated = data.allocatedCash; // sync legacy field
            }

            // 2. Handle Status Transitions
            if (data.status !== undefined && data.status !== bot.status) {
                const oldStatus = bot.status;
                const newStatus = data.status;

                if (oldStatus === 'ACTIVE' && (newStatus === 'PAUSED' || newStatus === 'STOPPED')) {
                    // Releasing non-deployed budget
                    const releasableCash = bot.allocatedCash - bot.deployedCash;
                    reservedCashAdjustment -= releasableCash;
                } else if ((oldStatus === 'PAUSED' || oldStatus === 'STOPPED') && newStatus === 'ACTIVE') {
                    // Re-locking non-deployed budget
                    const toReserveCash = bot.allocatedCash - bot.deployedCash;
                    const available = portfolio.cashBalance - (portfolio.reservedCash || 0);
                    if (available < toReserveCash) {
                        throw new Error(`Insufficient funds to activate bot: Re-locking budget of ₹${toReserveCash.toLocaleString()} exceeds available virtual cash.`);
                    }
                    reservedCashAdjustment += toReserveCash;
                }
                bot.status = newStatus;
            }

            // 3. Save portfolio updates if reservedCash changed
            if (reservedCashAdjustment !== 0) {
                portfolio.reservedCash = Math.max(0, (portfolio.reservedCash || 0) + reservedCashAdjustment);
                await infra.portfolio.save(portfolio, sess);
            }

            // 4. Update the bot details
            const updatedFields = {
                ...data,
                capitalAllocated: bot.capitalAllocated, // Keep synced
                allocatedCash: bot.allocatedCash,
                status: bot.status,
                updatedAt: new Date()
            };

            finalUpdatedBot = {
                ...bot,
                ...updatedFields
            };

            await infra.autoTradeBot.save(finalUpdatedBot);
        };

        try {
            if (sessionDb) {
                await sessionDb.withTransaction(async () => {
                    await updateBotTransaction(sessionDb);
                });
            } else {
                await updateBotTransaction();
            }
            success = true;
        } catch (txnErr: any) {
            console.error("Failed to execute bot update transaction:", txnErr);
            return NextResponse.json({ error: txnErr.message || "Failed to update bot." }, { status: 400 });
        } finally {
            if (sessionDb) {
                await sessionDb.endSession();
            }
        }

        if (success) {
            // Write update/status log
            try {
                const statusChange = data.status && data.status !== bot.status;
                const statusMsg = statusChange ? `State transition: ${bot.status} ➔ ${data.status}.` : '';
                await infra.autoTradeLog.save({
                    id: "",
                    botId: id,
                    timestamp: new Date(),
                    level: "INFO",
                    category: "SYSTEM",
                    message: `🔧 Bot Config Updated. ${statusMsg} Budget: ₹${finalUpdatedBot.allocatedCash.toLocaleString()}.`,
                    createdAt: new Date()
                });
            } catch (logErr) {
                console.error("Failed to write update log:", logErr);
            }

            // Notify user about bot status change if toggled
            if (data.status && data.status !== bot.status) {
                try {
                    const { NotificationService } = require("@/application/notification-service");
                    const ns = new NotificationService(infra.notification);
                    await ns.notifySignal(userId, {
                        symbol: "BOT",
                        type: "REVERSED_TREND",
                        strength: "MEDIUM",
                        description: `🤖 Auto-Trade bot "${bot.name}" is now ${data.status.toLowerCase()}.`,
                        timestamp: new Date()
                    });
                } catch (nsErr) {
                    console.error("Bot status notification failed:", nsErr);
                }
            }
        }

        // Fetch stats to enrich the response
        const portfolios = await infra.portfolio.findByUserId(userId);
        const portfolio = portfolios[0] || null;
        let holdings: any[] = [];
        if (portfolio) {
            const analyzer = new (require("@/application/portfolio-analyzer").PortfolioAnalyzer)(
                infra.stock, 
                infra.notification, 
                infra.trade,
                infra.market
            );
            const analyzed = await analyzer.analyze(portfolio);
            holdings = analyzed.holdings;
        }

        const trades = await infra.trade.findByUserId(userId);
        const { calculateBotStats } = require("@/application/bot-stats-calculator");
        const stats = calculateBotStats(finalUpdatedBot, trades, holdings);

        // Save stats back to DB
        infra.autoTradeBot.updateStats(finalUpdatedBot.id, stats).catch(err => {
            console.error(`[API PATCH] Failed to save stats:`, err);
        });

        return NextResponse.json({
            ...finalUpdatedBot,
            ...stats
        });
    } catch (error: any) {
        console.error("Update bot error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const infra = await getInfrastructure();
        const userId = (session.user as any).id;

        const bot = await infra.autoTradeBot.findById(id);
        if (!bot || bot.userId !== userId) {
            return NextResponse.json({ error: "Bot not found" }, { status: 404 });
        }

        const sessionDb = infra.mongoClient ? infra.mongoClient.startSession() : null;
        let success = false;

        const deleteBotTransaction = async (sess?: any) => {
            const portfolios = await infra.portfolio.findByUserId(userId, sess);
            if (portfolios.length > 0) {
                const portfolio = portfolios[0];
                
                // If bot is active, we release the non-deployed budget
                let releasableCash = 0;
                if (bot.status === 'ACTIVE') {
                    releasableCash = bot.allocatedCash - bot.deployedCash;
                } else if (bot.status === 'PAUSED' || bot.status === 'STOPPED') {
                    // If bot is paused/stopped, the non-deployed cash was already released.
                    // Thus, no additional cash needs to be released at this moment.
                    releasableCash = 0;
                }

                if (releasableCash > 0) {
                    portfolio.reservedCash = Math.max(0, (portfolio.reservedCash || 0) - releasableCash);
                    await infra.portfolio.save(portfolio, sess);
                }
            }

            // Perform deletion
            await infra.autoTradeBot.delete(id);
            await infra.autoTradeLog.deleteByBotId(id); // Delete historical logs
        };

        try {
            if (sessionDb) {
                await sessionDb.withTransaction(async () => {
                    await deleteBotTransaction(sessionDb);
                });
            } else {
                await deleteBotTransaction();
            }
            success = true;
        } catch (txnErr: any) {
            console.error("Failed to execute bot deletion transaction:", txnErr);
            return NextResponse.json({ error: txnErr.message || "Failed to delete bot." }, { status: 400 });
        } finally {
            if (sessionDb) {
                await sessionDb.endSession();
            }
        }

        return NextResponse.json({ message: "Bot deleted successfully" });
    } catch (error: any) {
        console.error("Delete bot error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
