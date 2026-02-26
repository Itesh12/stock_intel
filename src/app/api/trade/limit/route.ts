import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getInfrastructure } from "@/infrastructure/container";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { symbol, quantity, targetPrice, type } = await req.json();

        if (!symbol || !quantity || !targetPrice || !type) {
            return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
        }

        const infra = await getInfrastructure();
        const userId = (session.user as any).id;

        // Check if user has enough cash for BUY order
        if (type === 'BUY') {
            const portfolios = await infra.portfolio.findByUserId(userId);
            const portfolio = portfolios[0];
            const requiredCash = quantity * targetPrice;

            if (portfolio.cashBalance < requiredCash) {
                return NextResponse.json({ error: "Insufficient virtual capital for this limit" }, { status: 400 });
            }
        } else if (type === 'SELL') {
            // Check if user has enough units to sell
            const portfolios = await infra.portfolio.findByUserId(userId);
            const portfolio = portfolios[0];
            const holding = portfolio.holdings.find(h => h.symbol === symbol);

            if (!holding || holding.quantity < quantity) {
                return NextResponse.json({ error: "Insufficient units in portfolio" }, { status: 400 });
            }
        }

        const order = {
            id: uuidv4(),
            userId,
            symbol,
            quantity,
            targetPrice,
            type,
            status: 'PENDING' as any,
            timestamp: new Date()
        };

        await infra.limitOrder.save(order);

        return NextResponse.json({ success: true, order });

    } catch (err) {
        console.error("Limit order post failed", err);
        return NextResponse.json({ error: "Interal server error" }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const infra = await getInfrastructure();
        const userId = (session.user as any).id;
        const orders = await infra.limitOrder.findByUserId(userId);
        return NextResponse.json(orders);
    } catch (err) {
        return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: "Missing order ID" }, { status: 400 });

        const infra = await getInfrastructure();
        const userId = (session.user as any).id;

        const order = await infra.limitOrder.findById(id);
        if (!order || order.userId !== userId) {
            return NextResponse.json({ error: "Order not found" }, { status: 404 });
        }

        if (order.status !== 'PENDING') {
            return NextResponse.json({ error: "Only pending orders can be cancelled" }, { status: 400 });
        }

        await infra.limitOrder.updateStatus(id, 'CANCELLED');
        return NextResponse.json({ success: true });
    } catch (err) {
        return NextResponse.json({ error: "Failed to cancel order" }, { status: 500 });
    }
}
