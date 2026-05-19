import { NextRequest, NextResponse } from "next/server";
import { getInfrastructure } from "@/infrastructure/container";
import { CanslimScanner, IntermarketScanner } from "@/services/quant-scanner";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const infra = await getInfrastructure();
        const { CanslimScanner, IntermarketScanner, BuffetScanner, IntradayScanner, SwingScanner } = await import("@/services/quant-scanner");
        
        let scanner;
        if (id === 'canslim') scanner = new CanslimScanner(infra);
        else if (id === 'warren-buffet') scanner = new BuffetScanner(infra);
        else if (id === 'intraday-strategy') scanner = new IntradayScanner(infra);
        else if (id === 'swing-strategy') scanner = new SwingScanner(infra);
        else scanner = new IntermarketScanner(infra);

        const results = await scanner.scan();
        return NextResponse.json({ success: true, count: results.length });
    } catch (error: any) {
        console.error("Manual scan error:", error);
        return NextResponse.json({ error: "Scan failed" }, { status: 500 });
    }
}
