export default function MarketScanPage() {
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

            <MarketScanClient />
        </div>
    );
}

import MarketScanClient from './market-scan-client';
