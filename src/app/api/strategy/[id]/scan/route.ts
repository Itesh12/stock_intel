import { NextRequest, NextResponse } from "next/server";
import { getInfrastructure } from "@/infrastructure/container";
import { CanslimScanner } from "@/services/quant-scanner";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const infra = await getInfrastructure();
        const scanner = new CanslimScanner(infra);
        const results = await scanner.scan();
        return NextResponse.json({ success: true, count: results.length });
    } catch (error: any) {
        console.error("Manual scan error:", error);
        return NextResponse.json({ error: "Scan failed" }, { status: 500 });
    }
}
