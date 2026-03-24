import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
    try {
        const symbolsPath = path.join(process.cwd(), 'src/data/indian-symbols.json');
        const allSymbols = JSON.parse(fs.readFileSync(symbolsPath, 'utf8'));

        // For backtesting, we sample 100 stocks to prevent Yahoo Finance rate limits
        // while still giving a statistically significant real-data subset.
        const discoveryPool = allSymbols
            .sort(() => 0.5 - Math.random())
            .slice(0, 100);

        return NextResponse.json({ symbols: discoveryPool });
    } catch (error: any) {
        console.error("Backtest Init Error:", error);
        return NextResponse.json({ error: "Failed to initialize backtest" }, { status: 500 });
    }
}
