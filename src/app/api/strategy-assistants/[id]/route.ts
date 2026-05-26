import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getInfrastructure } from "@/infrastructure/container";
import { AssistantLifecycleService } from "@/application/assistant-lifecycle-service";
import { z } from "zod";

export const dynamic = "force-dynamic";

const AssistantUpdateSchema = z.object({
    name: z.string().min(1, "Assistant name is required").optional(),
    status: z.enum(["RUNNING", "PAUSED"]).optional(),
    allocatedCapital: z.number().positive("Allocated capital must be positive").optional(),
    maxPositionSizePercent: z.number().min(5).max(100).optional(),
    stopLossPercent: z.number().positive().optional(),
    takeProfitPercent: z.number().positive().optional(),
    useTrailingStop: z.boolean().optional(),
    minConfluenceScore: z.number().min(0).max(100).optional(),
    
    // Safety Circuit Breakers
    maxDailyLoss: z.number().min(0).optional(),
    maxConcurrentPositions: z.number().int().min(1).max(20).optional(),
    cooldownPeriodMinutes: z.number().min(0).optional(),
    maxSectorAllocationPercent: z.number().min(5).max(100).optional(),
    drawdownProtectionPercent: z.number().min(0).max(100).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    if (process.env.ENABLE_STRATEGY_ASSISTANTS !== "true") {
        return NextResponse.json({ error: "Strategy Assistants module is disabled" }, { status: 403 });
    }

    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const body = await req.json();
        const validation = AssistantUpdateSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ 
                error: "Invalid update parameters", 
                details: validation.error.flatten().fieldErrors 
            }, { status: 400 });
        }

        const data = validation.data;
        const infra = await getInfrastructure();
        const userId = (session.user as any).id;

        let assistant = await infra.strategyAssistant.findById(id);
        if (!assistant || assistant.userId !== userId) {
            return NextResponse.json({ error: "Assistant not found" }, { status: 404 });
        }

        const lifecycle = new AssistantLifecycleService(infra);

        // 1. Handle Status Transitions first (via lifecycle service)
        if (data.status !== undefined && data.status !== assistant.status) {
            if (data.status === 'PAUSED') {
                if (assistant.status === 'RUNNING') {
                    await lifecycle.pauseAssistant(id, userId);
                    const reloaded = await infra.strategyAssistant.findById(id);
                    if (reloaded) assistant = reloaded;
                }
            } else if (data.status === 'RUNNING') {
                if (assistant.status === 'PAUSED' || assistant.status === 'RISK_STOPPED') {
                    await lifecycle.resumeAssistant(id, userId);
                    const reloaded = await infra.strategyAssistant.findById(id);
                    if (reloaded) assistant = reloaded;
                }
            }
        }

        // 2. Handle configuration updates inside database transaction if any other fields changed
        const hasOtherUpdates = Object.keys(data).some(key => key !== 'status');
        let finalUpdatedAssistant = { ...assistant };

        if (hasOtherUpdates) {
            const sessionDb = infra.mongoClient ? infra.mongoClient.startSession() : null;
            let success = false;

            const updateAssistantTransaction = async (sess?: any) => {
                const portfolios = await infra.portfolio.findByUserId(userId, sess);
                if (portfolios.length === 0) throw new Error("Portfolio not found");
                const portfolio = portfolios[0];

                let reservedCashAdjustment = 0;

                // Handle budget limit updates
                if (data.allocatedCapital !== undefined && data.allocatedCapital !== assistant.allocatedCapital) {
                    if (data.allocatedCapital < assistant.deployedCapital) {
                        throw new Error(`Cannot reduce budget (₹${data.allocatedCapital.toLocaleString()}) below active position expenditure (₹${assistant.deployedCapital.toLocaleString()}).`);
                    }

                    const cashDelta = data.allocatedCapital - assistant.allocatedCapital;
                    // If assistant is active (RUNNING), adjust reservedCash immediately
                    if (assistant.status === 'RUNNING') {
                        if (cashDelta > 0) {
                            const available = portfolio.cashBalance - (portfolio.reservedCash || 0);
                            if (available < cashDelta) {
                                throw new Error(`Insufficient funds: Budget increase of ₹${cashDelta.toLocaleString()} exceeds available virtual balance.`);
                            }
                        }
                        reservedCashAdjustment += cashDelta;
                    }
                    assistant.allocatedCapital = data.allocatedCapital;
                }

                // Save portfolio updates if reservedCash changed
                if (reservedCashAdjustment !== 0) {
                    portfolio.reservedCash = Math.max(0, (portfolio.reservedCash || 0) + reservedCashAdjustment);
                    await infra.portfolio.save(portfolio, sess);
                }

                // Update the assistant details
                const updatedFields = {
                    ...data,
                    allocatedCapital: assistant.allocatedCapital,
                    updatedAt: new Date()
                };

                // Remove status from updatedFields since status changes are handled via lifecycle methods
                delete (updatedFields as any).status;

                finalUpdatedAssistant = {
                    ...assistant,
                    ...updatedFields
                };

                await infra.strategyAssistant.save(finalUpdatedAssistant);
            };

            try {
                if (sessionDb) {
                    await sessionDb.withTransaction(async () => {
                        await updateAssistantTransaction(sessionDb);
                    });
                } else {
                    await updateAssistantTransaction();
                }
                success = true;
            } catch (txnErr: any) {
                console.error("Failed to execute assistant update transaction:", txnErr);
                return NextResponse.json({ error: txnErr.message || "Failed to update assistant." }, { status: 400 });
            } finally {
                if (sessionDb) {
                    await sessionDb.endSession();
                }
            }

            if (success) {
                try {
                    await infra.assistantLog.save({
                        id: "",
                        botId: id,
                        timestamp: new Date(),
                        level: "INFO",
                        category: "SYSTEM",
                        message: `🔧 Assistant Config Updated. Budget: ₹${finalUpdatedAssistant.allocatedCapital.toLocaleString()}.`,
                        createdAt: new Date()
                    });
                } catch (logErr) {
                    console.error("Failed to write update log:", logErr);
                }
            }
        } else {
            finalUpdatedAssistant = assistant;
        }

        // Notify user about assistant status change if toggled
        if (data.status && data.status !== assistant.status) {
            try {
                const { NotificationService } = require("@/application/notification-service");
                const ns = new NotificationService(infra.notification);
                await ns.notifySignal(userId, {
                    symbol: "BOT",
                    type: "REVERSED_TREND",
                    strength: "MEDIUM",
                    description: `🤖 Strategy Assistant "${assistant.name}" is now ${data.status.toLowerCase()}.`,
                    timestamp: new Date()
                });
            } catch (nsErr) {
                console.error("Assistant status notification failed:", nsErr);
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
        const { calculateAssistantStats } = require("@/application/assistant-stats-calculator");
        const stats = calculateAssistantStats(finalUpdatedAssistant, trades, holdings);

        // Save stats back to DB
        infra.strategyAssistant.updateStats(finalUpdatedAssistant.id, {
            totalPnL: stats.totalPnL,
            winCount: stats.winCount,
            lossCount: stats.lossCount,
            totalTradesExecuted: stats.totalTradesExecuted,
        }).catch(err => {
            console.error(`[API PATCH] Failed to save stats:`, err);
        });

        return NextResponse.json({
            ...finalUpdatedAssistant,
            ...stats
        });
    } catch (error: any) {
        console.error("Update assistant error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    if (process.env.ENABLE_STRATEGY_ASSISTANTS !== "true") {
        return NextResponse.json({ error: "Strategy Assistants module is disabled" }, { status: 403 });
    }

    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const infra = await getInfrastructure();
        const userId = (session.user as any).id;

        const assistant = await infra.strategyAssistant.findById(id);
        if (!assistant || assistant.userId !== userId) {
            return NextResponse.json({ error: "Assistant not found" }, { status: 404 });
        }

        const { searchParams } = new URL(req.url);
        let liquidate = searchParams.get("liquidate") === "true";

        // Also check request body in case it's passed there
        try {
            const body = await req.json();
            if (body && typeof body.liquidate === 'boolean') {
                liquidate = body.liquidate;
            }
        } catch (_) {}

        const lifecycle = new AssistantLifecycleService(infra);
        await lifecycle.deleteAssistant(id, userId, liquidate);

        return NextResponse.json({ message: "Assistant deleted successfully" });
    } catch (error: any) {
        console.error("Delete assistant error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
