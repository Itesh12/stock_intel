import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getInfrastructure } from "@/infrastructure/container";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const infra = await getInfrastructure();
        const userId = (session.user as any).id;

        // Verify bot belongs to user
        const bot = await infra.autoTradeBot.findById(id);
        if (!bot || bot.userId !== userId) {
            return NextResponse.json({ error: "Bot not found" }, { status: 404 });
        }

        // Get all trades and filter by botId
        const allTrades = await infra.trade.findByUserId(userId);
        const botTrades = allTrades.filter(t => t.botId === id);

        return NextResponse.json(botTrades);
    } catch (error: any) {
        console.error("Fetch bot history error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
