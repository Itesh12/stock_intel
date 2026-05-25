import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getInfrastructure } from "@/infrastructure/container";
import { AssistantLifecycleService } from "@/application/assistant-lifecycle-service";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

export const dynamic = "force-dynamic";

const AssistantCreateSchema = z.object({
    name: z.string().min(1, "Assistant name is required"),
    strategySlug: z.string(),
    allocatedCapital: z.number().positive("Allocated capital must be positive"),
    maxPositionSizePercent: z.number().min(5).max(100),
    stopLossPercent: z.number().positive(),
    takeProfitPercent: z.number().positive(),
    useTrailingStop: z.boolean(),
    minConfluenceScore: z.number().min(0).max(100),
    
    // Safety Circuit Breakers
    maxDailyLoss: z.number().min(0),
    maxConcurrentPositions: z.number().int().min(1).max(20),
    cooldownPeriodMinutes: z.number().min(0),
    maxSectorAllocationPercent: z.number().min(5).max(100),
    drawdownProtectionPercent: z.number().min(0).max(100),
});

export async function GET() {
    if (process.env.ENABLE_STRATEGY_ASSISTANTS !== "true") {
        return NextResponse.json({ error: "Strategy Assistants module is disabled" }, { status: 403 });
    }

    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const infra = await getInfrastructure();
        const userId = (session.user as any).id;

        const assistants = await infra.strategyAssistant.findByUserId(userId);

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
        const { calculateAssistantStats } = require("@/application/assistant-stats-calculator");

        const enrichedAssistants = assistants.map(assistant => {
            const stats = calculateAssistantStats(assistant, trades, holdings);
            // Async update database cache
            infra.strategyAssistant.updateStats(assistant.id, {
                totalPnL: stats.totalPnL,
                winCount: stats.winCount,
                lossCount: stats.lossCount,
                totalTradesExecuted: stats.totalTradesExecuted,
            }).catch(err => {
                console.error(`[API Assistants] Failed to update assistant stats:`, err);
            });

            return {
                ...assistant,
                ...stats
            };
        });

        return NextResponse.json(enrichedAssistants);
    } catch (error: any) {
        console.error("Fetch assistants error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    if (process.env.ENABLE_STRATEGY_ASSISTANTS !== "true") {
        return NextResponse.json({ error: "Strategy Assistants module is disabled" }, { status: 403 });
    }

    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const validation = AssistantCreateSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ 
                error: "Invalid assistant configuration", 
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

        const newAssistantId = uuidv4();
        const newAssistant = {
            id: newAssistantId,
            userId,
            name: data.name,
            strategySlug: data.strategySlug,
            strategyName: strategy.name,
            status: 'RUNNING' as const, // Starts running on creation
            mode: 'paper' as const,
            allocatedCapital: data.allocatedCapital,
            deployedCapital: 0,
            maxPositionSizePercent: data.maxPositionSizePercent,
            stopLossPercent: data.stopLossPercent,
            takeProfitPercent: data.takeProfitPercent,
            useTrailingStop: data.useTrailingStop,
            minConfluenceScore: data.minConfluenceScore,
            maxDailyLoss: data.maxDailyLoss,
            maxConcurrentPositions: data.maxConcurrentPositions,
            cooldownPeriodMinutes: data.cooldownPeriodMinutes,
            maxSectorAllocationPercent: data.maxSectorAllocationPercent,
            drawdownProtectionPercent: data.drawdownProtectionPercent,
            totalTradesExecuted: 0,
            winCount: 0,
            lossCount: 0,
            totalPnL: 0,
            todayTradeCount: 0,
            todayDate: new Date().toISOString().slice(0, 10),
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const lifecycle = new AssistantLifecycleService(infra);
        await lifecycle.createAssistant(newAssistant);

        // Send UI notification
        try {
            const { NotificationService } = require("@/application/notification-service");
            const ns = new NotificationService(infra.notification);
            await ns.notifySignal(userId, {
                symbol: "BOT",
                type: "INSTITUTIONAL_BUY",
                strength: "HIGH",
                description: `🤖 Strategy Assistant "${newAssistant.name}" deployed successfully on ${newAssistant.strategyName}!`,
                timestamp: new Date()
            });
        } catch (nsErr) {
            console.error("Assistant notification failed:", nsErr);
        }

        return NextResponse.json(newAssistant, { status: 201 });
    } catch (error: any) {
        console.error("Create assistant error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
