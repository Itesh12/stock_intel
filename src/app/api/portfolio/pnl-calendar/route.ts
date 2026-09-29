import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getInfrastructure } from "@/infrastructure/container";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const infra = await getInfrastructure();
        const userId = (session.user as any).id;

        const trades = await infra.trade.findByUserId(userId);

        // Group trades by date 'YYYY-MM-DD'
        const dailyMap: Record<string, {
            date: string;
            netPL: number;
            totalTrades: number;
            buyCount: number;
            sellCount: number;
            winCount: number;
            lossCount: number;
            trades: Array<{
                id: string;
                symbol: string;
                type: 'BUY' | 'SELL';
                quantity: number;
                price: number;
                totalValue: number;
                realizedPL?: number;
                averagePriceAtSale?: number;
                timestamp: string;
            }>;
        }> = {};

        for (const t of trades) {
            if (!t.timestamp) continue;
            const dateObj = new Date(t.timestamp);
            if (isNaN(dateObj.getTime())) continue;

            const year = dateObj.getFullYear();
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const dayNum = String(dateObj.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${dayNum}`;

            if (!dailyMap[dateStr]) {
                dailyMap[dateStr] = {
                    date: dateStr,
                    netPL: 0,
                    totalTrades: 0,
                    buyCount: 0,
                    sellCount: 0,
                    winCount: 0,
                    lossCount: 0,
                    trades: []
                };
            }

            const dayRecord = dailyMap[dateStr];
            dayRecord.totalTrades += 1;

            const isSell = t.type === 'SELL';
            let realizedPL = 0;

            if (isSell) {
                dayRecord.sellCount += 1;
                if (typeof t.realizedPL === 'number') {
                    realizedPL = t.realizedPL;
                } else if (typeof t.averagePriceAtSale === 'number' && t.averagePriceAtSale > 0) {
                    realizedPL = (t.price - t.averagePriceAtSale) * t.quantity;
                }
                dayRecord.netPL += realizedPL;
                if (realizedPL > 0) dayRecord.winCount += 1;
                else if (realizedPL < 0) dayRecord.lossCount += 1;
            } else {
                dayRecord.buyCount += 1;
            }

            dayRecord.trades.push({
                id: t.id,
                symbol: t.symbol,
                type: t.type,
                quantity: t.quantity,
                price: t.price,
                totalValue: t.totalValue,
                realizedPL: isSell ? realizedPL : undefined,
                averagePriceAtSale: t.averagePriceAtSale,
                timestamp: dateObj.toISOString()
            });
        }

        return NextResponse.json({
            dailyPnl: dailyMap
        });
    } catch (err: any) {
        console.error("P&L calendar API error:", err);
        return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
    }
}
