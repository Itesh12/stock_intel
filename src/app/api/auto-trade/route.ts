import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getInfrastructure } from "@/infrastructure/container";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

export const dynamic = "force-dynamic";

const BotCreateSchema = z.object({
    name: z.string().min(1, "Bot name is required"),
    strategySlug: z.string(),
    allocatedCash: z.number().positive("Allocated cash must be positive"),
    maxPositionSizePercent: z.number().min(5).max(100),
    riskPerTradePercent: z.number().min(0.5).max(10),
    maxTradesPerDay: z.number().int().positive(),
    stopLossPercent: z.number().positive(),
    takeProfitPercent: z.number().positive(),
    minConfluenceScore: z.number().min(0).max(100),
    
    // Advanced Risk Controls
    maxDailyLoss: z.number().min(0),
    maxConcurrentPositions: z.number().int().min(1).max(20),
    cooldownPeriodMinutes: z.number().min(0),
    maxSectorAllocationPercent: z.number().min(5).max(100),
    drawdownProtectionPercent: z.number().min(0).max(100),
    useTrailingStop: z.boolean(),
});

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const infra = await getInfrastructure();
        const userId = (session.user as any).id;

        const bots = await infra.autoTradeBot.findByUserId(userId);

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

        const enrichedBots = bots.map(bot => {
            const stats = calculateBotStats(bot, trades, holdings);
            // Async update DB cache
            infra.autoTradeBot.updateStats(bot.id, stats).catch(err => {
                console.error(`[API AutoTrade] Failed to update bot stats in DB:`, err);
            });
            return {
                ...bot,
                ...stats
            };
        });

        return NextResponse.json(enrichedBots);
    } catch (error: any) {
        console.error("Fetch bots error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const validation = BotCreateSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ 
                error: "Invalid bot configuration", 
                details: validation.error.flatten().fieldErrors 
            }, { status: 400 });
        }

        const data = validation.data;
        const infra = await getInfrastructure();
        const userId = (session.user as any).id;

        // Verify strategy exists
        const strategy = await infra.strategy.findBySlug(data.strategySlug);
        if (!strategy) {
            return NextResponse.json({ error: "Selected strategy does not exist" }, { status: 404 });
        }

        // Verify user portfolio has enough available funds
        const portfolios = await infra.portfolio.findByUserId(userId);
        if (portfolios.length === 0) {
            return NextResponse.json({ error: "No portfolio found. Please configure a portfolio first." }, { status: 400 });
        }
        
        let portfolio = portfolios[0];
        const newBotId = uuidv4();
        
        const newBot = {
            id: newBotId,
            userId,
            name: data.name,
            strategySlug: data.strategySlug,
            strategyName: strategy.name,
            status: 'ACTIVE' as const,
            capitalAllocated: data.allocatedCash, // Keep legacy field in sync
            allocatedCash: data.allocatedCash,
            deployedCash: 0,
            maxPositionSizePercent: data.maxPositionSizePercent,
            riskPerTradePercent: data.riskPerTradePercent,
            maxTradesPerDay: data.maxTradesPerDay,
            stopLossPercent: data.stopLossPercent,
            takeProfitPercent: data.takeProfitPercent,
            minConfluenceScore: data.minConfluenceScore,
            
            // Advanced Risk Controls
            maxDailyLoss: data.maxDailyLoss,
            maxConcurrentPositions: data.maxConcurrentPositions,
            cooldownPeriodMinutes: data.cooldownPeriodMinutes,
            maxSectorAllocationPercent: data.maxSectorAllocationPercent,
            drawdownProtectionPercent: data.drawdownProtectionPercent,
            useTrailingStop: data.useTrailingStop,

            totalTradesExecuted: 0,
            winCount: 0,
            lossCount: 0,
            totalPnL: 0,
            todayTradeCount: 0,
            todayDate: new Date().toISOString().slice(0, 10),
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const sessionDb = infra.mongoClient ? infra.mongoClient.startSession() : null;
        let success = false;

        const createBotTransaction = async (sess?: any) => {
            // Reload latest portfolio inside session
            const reloadedPortfolios = await infra.portfolio.findByUserId(userId, sess);
            if (reloadedPortfolios.length === 0) throw new Error("Portfolio not found");
            portfolio = reloadedPortfolios[0];

            const availablePortfolioCash = portfolio.cashBalance - (portfolio.reservedCash || 0);
            if (availablePortfolioCash < data.allocatedCash) {
                throw new Error(`Insufficient funds: Allocated cash (₹${data.allocatedCash.toLocaleString()}) exceeds available virtual cash balance (₹${availablePortfolioCash.toLocaleString()}).`);
            }

            // Lock budget in reservedCash
            portfolio.reservedCash = (portfolio.reservedCash || 0) + data.allocatedCash;
            await infra.portfolio.save(portfolio, sess);

            // Save bot
            await infra.autoTradeBot.save(newBot);
        };

        try {
            if (sessionDb) {
                await sessionDb.withTransaction(async () => {
                    await createBotTransaction(sessionDb);
                });
            } else {
                await createBotTransaction();
            }
            success = true;
        } catch (txnErr: any) {
            console.error("Failed to execute bot creation transaction:", txnErr);
            return NextResponse.json({ error: txnErr.message || "Failed to create bot due to transaction failure." }, { status: 400 });
        } finally {
            if (sessionDb) {
                await sessionDb.endSession();
            }
        }

        if (success) {
            // Write deployment log
            try {
                await infra.autoTradeLog.save({
                    id: "",
                    botId: newBotId,
                    timestamp: new Date(),
                    level: "INFO",
                    category: "SYSTEM",
                    message: `🤖 Bot Deployed: "${newBot.name}" successfully active on ${newBot.strategyName}. Reserved Cash: ₹${newBot.allocatedCash.toLocaleString()}.`,
                    createdAt: new Date()
                });
            } catch (logErr) {
                console.error("Failed to write deployment log:", logErr);
            }

            // Notify user about bot launch
            try {
                const { NotificationService } = require("@/application/notification-service");
                const ns = new NotificationService(infra.notification);
                await ns.notifySignal(userId, {
                    symbol: "BOT",
                    type: "INSTITUTIONAL_BUY",
                    strength: "HIGH",
                    description: `🤖 Auto-Trade bot "${newBot.name}" successfully deployed on ${newBot.strategyName}!`,
                    timestamp: new Date()
                });
            } catch (nsErr) {
                console.error("Bot notification failed:", nsErr);
            }
        }

        return NextResponse.json(newBot);
    } catch (error: any) {
        console.error("Create bot error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
