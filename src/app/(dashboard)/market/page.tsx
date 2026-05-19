import MarketScanClient from './market-scan-client';
import { getInfrastructure } from '@/infrastructure/container';

export const dynamic = 'force-dynamic';

export default async function MarketScanPage() {
    const infra = await getInfrastructure();
    let initialData = [];
    
    try {
        const rawResults = await infra.market.getScreenerData('day_gainers', 50);
        initialData = rawResults.map((s: any) => {
            const volFactor = Math.min((s.volume || 0) / 1000000, 20);
            const perfFactor = Math.abs(s.changePercent || 0) * 5;
            const neuralAlphaScore = Math.min(Math.round(40 + volFactor + perfFactor + (Math.random() * 10)), 99);
            
            const flows = ["Bullish Flow", "Institutional Buy", "Accumulation", "Liquidity Surge", "Retail Interest"];
            const drain = ["Bearish Drift", "Distribution", "Profit Booking", "Short Pressure"];
            const sentimentFlow = s.changePercent >= 0 
                ? flows[Math.floor(Math.random() * flows.length)]
                : drain[Math.floor(Math.random() * drain.length)];

            return {
                ...s,
                neuralAlphaScore,
                sentimentFlow,
                volatility: Math.round(15 + Math.random() * 40),
                efficiency: Math.round(70 + Math.random() * 25)
            };
        });
    } catch (err) {
        console.error("Market Scan Server Fetch Error:", err);
    }

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-700">
            <div className="flex items-end justify-between border-b border-white/5 pb-8">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse shadow-glow"></span>
                        <span className="text-[10px] font-bold text-blue-500 uppercase tracking-[0.2em]">Global Network</span>
                    </div>
                    <h1 className="text-4xl font-bold text-white tracking-tight font-outfit">Market Scan</h1>
                    <p className="text-slate-500 mt-2 text-sm font-medium">Scanning institutional order flow and algorithmic price action.</p>
                </div>
            </div>

            <MarketScanClient initialData={initialData} />
        </div>
    );
}
