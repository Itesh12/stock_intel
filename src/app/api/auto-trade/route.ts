import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getInfrastructure } from "@/infrastructure/container";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

const BotCreateSchema = z.object({
    name: z.string().min(1, "Bot name is required"),
    strategySlug: z.string(),
    capitalAllocated: z.number().positive(),
    maxPositionSizePercent: z.number().min(5).max(100),
    riskPerTradePercent: z.number().min(0.5).max(10),
    maxTradesPerDay: z.number().int().positive(),
    stopLossPercent: z.number().positive(),
    takeProfitPercent: z.number().positive(),
    minConfluenceScore: z.number().min(0).max(100),
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

        // Verify user portfolio has enough funds for allocation
        const portfolios = await infra.portfolio.findByUserId(userId);
        if (portfolios.length === 0) {
            return NextResponse.json({ error: "No portfolio found. Please configure a portfolio first." }, { status: 400 });
        }
        const portfolio = portfolios[0];

        // Let's check how many active bots user already has and how much total capital is allocated.
        const userBots = await infra.autoTradeBot.findByUserId(userId);
        const activeAllocated = userBots
            .filter(b => b.status === 'ACTIVE')
            .reduce((sum, b) => sum + b.capitalAllocated, 0);

        if (portfolio.cashBalance < data.capitalAllocated) {
            return NextResponse.json({ 
                error: `Allocated capital (₹${data.capitalAllocated.toLocaleString()}) exceeds active virtual cash balance (₹${portfolio.cashBalance.toLocaleString()})` 
            }, { status: 400 });
        }

        const newBot = {
            id: uuidv4(),
            userId,
            name: data.name,
            strategySlug: data.strategySlug,
            strategyName: strategy.name,
            status: 'ACTIVE' as const,
            capitalAllocated: data.capitalAllocated,
            maxPositionSizePercent: data.maxPositionSizePercent,
            riskPerTradePercent: data.riskPerTradePercent,
            maxTradesPerDay: data.maxTradesPerDay,
            stopLossPercent: data.stopLossPercent,
            takeProfitPercent: data.takeProfitPercent,
            minConfluenceScore: data.minConfluenceScore,
            totalTradesExecuted: 0,
            winCount: 0,
            lossCount: 0,
            totalPnL: 0,
            todayTradeCount: 0,
            todayDate: new Date().toISOString().slice(0, 10),
            createdAt: new Date(),
            updatedAt: new Date()
        };

        await infra.autoTradeBot.save(newBot);

        // Notify user about bot launch
        try {
            const { NotificationService } = require("@/application/notification-service");
            const ns = new NotificationService(infra.notification);
            await ns.notifySignal(userId, {
                symbol: "BOT",
                type: "INSTITUTIONAL_BUY", // using standard allowed notification types
                strength: "HIGH",
                description: `🤖 Auto-Trade bot "${newBot.name}" successfully deployed on ${newBot.strategyName}!`,
                timestamp: new Date()
            });
        } catch (nsErr) {
            console.error("Bot notification failed:", nsErr);
        }

        return NextResponse.json(newBot);
    } catch (error: any) {
        console.error("Create bot error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
