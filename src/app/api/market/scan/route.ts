import { NextResponse } from 'next/server';
import { getInfrastructure } from '@/infrastructure/container';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'day_gainers';
    const count = parseInt(searchParams.get('count') || '50');

    try {
        const infra = await getInfrastructure();
        const rawResults = await infra.market.getScreenerData(type, count);

        // ENRICH WITH QUANTUM ALPHA METRICS
        const results = rawResults.map((s: any) => {
            // Simulated Neural Alpha Score (0-100)
            // Combined weighted factor of performance and volume "integrity"
            const volFactor = Math.min((s.volume || 0) / 1000000, 20); // Normalized volume influence
            const perfFactor = Math.abs(s.changePercent || 0) * 5;
            const neuralAlphaScore = Math.min(Math.round(40 + volFactor + perfFactor + (Math.random() * 10)), 99);

            // Sentiment Flow Chip
            const flows = ["Bullish Flow", "Institutional Buy", "Accumulation", "Liquidity Surge", "Retail Interest"];
            const drain = ["Bearish Drift", "Distribution", "Profit Booking", "Short Pressure"];
            const sentimentFlow = s.changePercent >= 0 
                ? flows[Math.floor(Math.random() * flows.length)]
                : drain[Math.floor(Math.random() * drain.length)];

            return {
                ...s,
                neuralAlphaScore,
                sentimentFlow,
                volatility: Math.round(15 + Math.random() * 40), // Simulated VIX-style calc
                efficiency: Math.round(70 + Math.random() * 25)
            };
        });

        return NextResponse.json(results);
    } catch (error) {
        console.error('Error in market scan API:', error);
        return NextResponse.json({ error: 'Failed to fetch scan results' }, { status: 500 });
    }
}
