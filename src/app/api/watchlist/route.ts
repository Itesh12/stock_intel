import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { getInfrastructure } from "@/infrastructure/container";

export async function GET(req: NextRequest) {
    const session = await getServerSession();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const infra = await getInfrastructure();
    const user = await infra.user.findByEmail(session.user.email!);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const watchlist = await infra.watchlist.findByUserId(user.id);
    return NextResponse.json(watchlist?.symbols || []);
}

export async function POST(req: NextRequest) {
    const session = await getServerSession();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { symbol, action } = await req.json();
    if (!symbol) return NextResponse.json({ error: "Symbol required" }, { status: 400 });

    const infra = await getInfrastructure();
    const user = await infra.user.findByEmail(session.user.email!);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (action === 'ADD') {
        await infra.watchlist.addSymbol(user.id, symbol);
    } else if (action === 'REMOVE') {
        await infra.watchlist.removeSymbol(user.id, symbol);
    }

    return NextResponse.json({ success: true });
}
