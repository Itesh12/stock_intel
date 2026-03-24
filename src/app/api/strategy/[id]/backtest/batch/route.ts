import { NextRequest, NextResponse } from "next/server";
import yahooFinance from "yahoo-finance2";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const { symbols, days } = body;

        if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
            return NextResponse.json({ error: "No symbols provided" }, { status: 400 });
        }

        const today = new Date();
        const entryDate = new Date();
        entryDate.setDate(today.getDate() - parseInt(days));

        // We need 1 year of context BEFORE the entry date to calculate 200SMA and 52W High on that exact day
        const fetchStartDate = new Date(entryDate);
        fetchStartDate.setDate(fetchStartDate.getDate() - 365);

        const results = await Promise.all(symbols.map(async (symbol: string) => {
            try {
                let history: any[] = [];
                try {
                    history = await yahooFinance.historical(symbol, {
                        period1: fetchStartDate,
                        period2: today,
                        interval: "1d"
                    });
                } catch (e) {
                    history = [];
                }

                if (history.length < 200) return { symbol, isMatch: false }; // Not enough context

                // Find the index of the entry date
                let entryIdx = -1;
                for (let i = 0; i < history.length; i++) {
                    if (history[i].date >= entryDate) {
                        entryIdx = i;
                        break;
                    }
                }

                if (entryIdx === -1 || entryIdx < 200) return { symbol, isMatch: false };

                // Evaluate indicators exactly on the entry date (using past 200 days)
                const entryContext = history.slice(0, entryIdx + 1);
                const entryCandle = entryContext[entryContext.length - 1];
                const entryPrice = entryCandle.close;

                // SMA 200
                const last200 = entryContext.slice(-200);
                const sma200 = last200.reduce((acc: number, c: any) => acc + c.close, 0) / 200;

                // 52W High (approx 252 trading days, or simply max of entryContext)
                let high52w = 0;
                for (let i = Math.max(0, entryContext.length - 252); i < entryContext.length; i++) {
                    if (entryContext[i].high > high52w) high52w = entryContext[i].high;
                }

                // Momentum: Price vs 20 days ago
                const price20dAgo = entryContext[entryContext.length - 21]?.close || entryPrice;
                const momentum20d = ((entryPrice - price20dAgo) / price20dAgo) * 100;

                let score = 0;
                let isMatch = false;

                // Fetch current fundamental proxy (Debt/Equity etc) because historical fundamentals aren't available via free API
                let quote: any = null;
                try {
                    quote = await yahooFinance.quote(symbol);
                } catch (e) {
                    quote = null;
                }

                if (id === 'canslim') {
                    // Relaxed Proxies for CANSLIM
                    const breakoutPass = entryPrice >= high52w * 0.70; // Within 30% of 52w high
                    const trendPass = entryPrice > sma200 * 0.95;
                    const momPass = momentum20d > 0; // Positive momentum
                    
                    if (breakoutPass) score += 40;
                    if (trendPass) score += 30;
                    if (momPass) score += 30;

                    isMatch = score >= 50;
                } else {
                    // Relaxed Default to Intermarket / General Breakout strategy
                    const breakoutPass = entryPrice >= high52w * 0.60;
                    const trendPass = entryPrice > sma200 * 0.90;
                    const momPass = momentum20d > -5;

                    if (breakoutPass) score += 40;
                    if (trendPass) score += 30;
                    if (momPass) score += 20;
                    if (quote?.marketCap && quote.marketCap > 50000000) score += 10;

                    isMatch = score >= 50;
                }

                if (!isMatch) return { symbol, isMatch: false };

                // IF MATCH: Calculate forward performance from entry date to today
                const forwardHistory = history.slice(entryIdx);
                const performance = forwardHistory.map((candle: any, i: number) => {
                    const ret = ((candle.close - entryPrice) / entryPrice) * 100;
                    return {
                        date: candle.date,
                        returnPercent: ret,
                        close: candle.close
                    }
                });

                const exitPrice = forwardHistory[forwardHistory.length - 1].close;
                const totalReturn = ((exitPrice - entryPrice) / entryPrice) * 100;

                return {
                    symbol,
                    isMatch: true,
                    entryPrice,
                    exitPrice,
                    totalReturn,
                    performance
                };

            } catch (err) {
                return { symbol, isMatch: false };
            }
        }));

        return NextResponse.json({ matches: results.filter(r => r.isMatch) });
    } catch (error: any) {
        console.error("Backtest Batch Error:", error);
        return NextResponse.json({ error: "Failed to process backtest batch" }, { status: 500 });
    }
}
