import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
    try {
        const symbolsPath = path.join(process.cwd(), 'src/data/indian-symbols.json');
        const allSymbols = JSON.parse(fs.readFileSync(symbolsPath, 'utf8'));

        // We removed sampling. The orchestrator will now process the ENTIRE NSE symbol list.
        // It will take longer and evaluate in batches, but it guarantees the absolute Top 20 from the whole market.
        const discoveryPool = allSymbols.sort(() => 0.5 - Math.random());

        return NextResponse.json({ symbols: discoveryPool });
    } catch (error: any) {
        console.error("Backtest Init Error:", error);
        return NextResponse.json({ error: "Failed to initialize backtest" }, { status: 500 });
    }
}
