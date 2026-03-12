import { NextRequest, NextResponse } from "next/server";
import { getInfrastructure } from "@/infrastructure/container";
import { IntelligenceService } from "@/application/intelligence-service";
import { ScoringService } from "@/application/scoring-service";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get("symbol");

    if (!symbol) {
        return NextResponse.json({ error: "Missing symbol" }, { status: 400 });
    }

    try {
        const infra = await getInfrastructure();
        const scoringService = new ScoringService();
        const intelligenceService = new IntelligenceService(infra, scoringService);
        
        const memo = await intelligenceService.generateDeepDive(symbol);
        
        if (!memo) {
            return NextResponse.json({ error: "Stock not found" }, { status: 404 });
        }

        return NextResponse.json(memo);
    } catch (error) {
        console.error("Intelligence API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
