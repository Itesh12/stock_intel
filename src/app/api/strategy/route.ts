import { NextResponse } from "next/server";
import { getInfrastructure } from "@/infrastructure/container";

export async function GET() {
    try {
        const infra = await getInfrastructure();
        const strategies = await infra.strategy.list();
        return NextResponse.json(strategies);
    } catch (error: any) {
        console.error("Strategies fetch error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
