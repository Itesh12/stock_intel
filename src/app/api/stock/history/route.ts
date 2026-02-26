import { NextResponse } from 'next/server';
import { getInfrastructure } from '@/infrastructure/container';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const period = searchParams.get('period') || '1mo';
    const fromStr = searchParams.get('from');
    const fromDate = fromStr ? new Date(fromStr) : undefined;

    if (!symbol) {
        return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    try {
        const infra = await getInfrastructure();
        const data = await infra.market.getHistoricalData(symbol, period, fromDate);
        return NextResponse.json(data);
    } catch (error) {
        console.error('History API error:', error);
        return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
    }
}
