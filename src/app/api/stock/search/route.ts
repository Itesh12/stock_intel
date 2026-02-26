import { NextResponse } from 'next/server';
import { getInfrastructure } from '@/infrastructure/container';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query) {
        return NextResponse.json([]);
    }

    try {
        const infra = await getInfrastructure();
        const results = await infra.market.searchStocks(query);

        // STRICT INDIAN MARKETS & FUTURES FILTERING
        // Only allow .NS (NSE), .BO (BSE), .F (Futures), and =F (Commodity Futures)
        const filteredResults = results.filter((s: any) => {
            const sym = (s.symbol || '').toUpperCase();

            // Exclude Mutual Funds (starting with 0P)
            if (sym.startsWith('0P')) return false;

            const isNSE = sym.endsWith('.NS');
            const isBSE = sym.endsWith('.BO');
            const isFuture = sym.endsWith('.F') || sym.includes('=F');

            return isNSE || isBSE || isFuture;
        });

        // Limit results to 15 suggestions for a "deeper" experience while staying focused
        return NextResponse.json(filteredResults.slice(0, 15));
    } catch (error) {
        console.error('Error searching stocks:', error);
        return NextResponse.json({ error: 'Failed to search stocks' }, { status: 500 });
    }
}
