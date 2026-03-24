import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
    try {
        const symbolsPath = path.join(process.cwd(), 'src/data/indian-symbols.json');
        const allSymbols = JSON.parse(fs.readFileSync(symbolsPath, 'utf8'));

        // We inject Nifty 50 ultra-heavyweights at the front of the pool.
        // This guarantees that the real-data historical engine evaluates stocks with pristine, 
        // gapless data on Yahoo Finance, avoiding "0 matches" logic crashes due to illiquid penny stocks.
        const heavyweights = [
            'RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'INFY.NS', 'ICICIBANK.NS', 
            'SBIN.NS', 'BHARTIARTL.NS', 'ITC.NS', 'LT.NS', 'TATAMOTORS.NS', 
            'KOTAKBANK.NS', 'AXISBANK.NS', 'BAJFINANCE.NS', 'MARUTI.NS', 'SUNPHARMA.NS', 
            'M&M.NS', 'TATASTEEL.NS', 'ASIANPAINT.NS', 'HCLTECH.NS', 'TITAN.NS'
        ];

        // Ensure heavyweights are actually real Indian strings logic
        const randomPool = allSymbols
            .filter((s: string) => !heavyweights.includes(s))
            .sort(() => 0.5 - Math.random())
            .slice(0, 50);

        const discoveryPool = [...heavyweights, ...randomPool];

        return NextResponse.json({ symbols: discoveryPool });
    } catch (error: any) {
        console.error("Backtest Init Error:", error);
        return NextResponse.json({ error: "Failed to initialize backtest" }, { status: 500 });
    }
}
