import React from 'react';
import { getInfrastructure } from '@/infrastructure/container';
import { AlertCircle } from 'lucide-react';
import Link from 'next/link';
import StockDetailClient from './stock-detail-client';

export default async function StockPage({ params }: { params: Promise<{ symbol: string }> }) {
    const resolvedParams = await params;
    const symbol = decodeURIComponent(resolvedParams.symbol);
    const infra = await getInfrastructure();

    if (!symbol || symbol === 'undefined') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
                <AlertCircle className="text-rose-500 mb-4" size={48} />
                <h1 className="text-2xl font-bold text-white mb-2">Invalid Symbol</h1>
                <p className="text-slate-500">The stock symbol provided is invalid or missing.</p>
                <Link href="/" className="mt-6 text-blue-500 hover:underline text-xs font-bold uppercase tracking-widest leading-none">Back to Global Pulse</Link>
            </div>
        );
    }

    try {
        const [priceData, historyData] = await Promise.all([
            infra.market.getStockPrice(symbol),
            infra.market.getHistoricalData(symbol, '1mo')
        ]);

        return (
            <StockDetailClient
                symbol={symbol}
                initialPriceData={priceData}
                initialHistoryData={historyData}
            />
        );
    } catch (error) {
        console.error("Failed to load stock page", error);
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
                <AlertCircle className="text-rose-500 mb-4" size={48} />
                <h1 className="text-2xl font-bold text-white mb-2">Error Loading Data</h1>
                <p className="text-slate-500">We couldn't retrieve market intelligence for this asset.</p>
                <Link href="/" className="mt-6 text-blue-500 hover:underline text-xs font-bold uppercase tracking-widest leading-none">Back to Global Pulse</Link>
            </div>
        );
    }
}
