import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getInfrastructure } from "@/infrastructure/container";
import { v4 as uuidv4 } from "uuid";

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const symbol = searchParams.get('symbol');
        const infra = await getInfrastructure();
        const userId = (session.user as any).id;

        let alerts = await infra.alert.findByUserId(userId);
        if (symbol) {
            alerts = alerts.filter(a => a.symbol === symbol);
        }
        
        return NextResponse.json(alerts);
    } catch (err) {
        return NextResponse.json({ error: "Failed to fetch alerts" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const infra = await getInfrastructure();
        const userId = (session.user as any).id;
        const body = await req.json();

        const alert = {
            id: uuidv4(),
            userId,
            symbol: body.symbol,
            targetPrice: body.targetPrice,
            condition: body.condition,
            isActive: true,
            createdAt: new Date()
        };

        await infra.alert.save(alert);
        return NextResponse.json(alert);
    } catch (err) {
        return NextResponse.json({ error: "Failed to save alert" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

        const infra = await getInfrastructure();
        const userId = (session.user as any).id;

        await infra.alert.delete(id, userId);
        return NextResponse.json({ success: true });
    } catch (err) {
        return NextResponse.json({ error: "Failed to delete alert" }, { status: 500 });
    }
}
