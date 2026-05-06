import { NextResponse } from "next/server";
import { getInfrastructure } from "@/infrastructure/container";
import { strategies as predefinedStrategies } from "@/data/strategies";

export async function GET() {
    try {
        const infra = await getInfrastructure();
        
        // Ensure predefined strategies are in the DB
        for (const s of predefinedStrategies) {
            const existing = await infra.strategy.findBySlug(s.id); // strategy.id is used as slug in data/strategies.ts
            if (!existing) {
                await infra.strategy.save({
                    ...s,
                    slug: s.id,
                    createdAt: new Date(),
                    updatedAt: new Date()
                } as any);
            }
        }

        const strategies = await infra.strategy.list();
        return NextResponse.json(strategies);
    } catch (error: any) {
        console.error("Strategies fetch error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
