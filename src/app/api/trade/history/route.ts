import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getInfrastructure } from "@/infrastructure/container";

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const infra = await getInfrastructure();
        const userId = (session.user as any).id;

        const trades = await infra.trade.findByUserId(userId);

        return NextResponse.json(trades);
    } catch (error: any) {
        console.error("Trade history fetch error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
