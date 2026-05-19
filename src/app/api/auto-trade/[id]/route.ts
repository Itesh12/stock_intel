import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getInfrastructure } from "@/infrastructure/container";
import { z } from "zod";

const BotUpdateSchema = z.object({
    name: z.string().min(1).optional(),
    status: z.enum(["ACTIVE", "PAUSED", "STOPPED"]).optional(),
    capitalAllocated: z.number().positive().optional(),
    maxPositionSizePercent: z.number().min(5).max(100).optional(),
    riskPerTradePercent: z.number().min(0.5).max(10).optional(),
    maxTradesPerDay: z.number().int().positive().optional(),
    stopLossPercent: z.number().positive().optional(),
    takeProfitPercent: z.number().positive().optional(),
    minConfluenceScore: z.number().min(0).max(100).optional(),
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

        const bot = await infra.autoTradeBot.findById(id);
        if (!bot || bot.userId !== userId) {
            return NextResponse.json({ error: "Bot not found" }, { status: 404 });
        }

        const updatedBot = {
            ...bot,
            ...data,
            updatedAt: new Date()
        };

        await infra.autoTradeBot.save(updatedBot);

        // Notify user about bot status change if toggled
        if (data.status && data.status !== bot.status) {
            try {
                const { NotificationService } = require("@/application/notification-service");
                const ns = new NotificationService(infra.notification);
                await ns.notifySignal(userId, {
                    symbol: "BOT",
                    type: "REVERSED_TREND", // standard allowed type
                    strength: "MEDIUM",
                    description: `🤖 Auto-Trade bot "${bot.name}" is now ${data.status.toLowerCase()}.`,
                    timestamp: new Date()
                });
            } catch (nsErr) {
                console.error("Bot status notification failed:", nsErr);
            }
        }

        return NextResponse.json(updatedBot);
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

        await infra.autoTradeBot.delete(id);

        return NextResponse.json({ message: "Bot deleted successfully" });
    } catch (error: any) {
        console.error("Delete bot error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
