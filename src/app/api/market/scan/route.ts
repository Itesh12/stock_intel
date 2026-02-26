import { NextResponse } from 'next/server';
import { getInfrastructure } from '@/infrastructure/container';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'day_gainers';
    const count = parseInt(searchParams.get('count') || '50');

    try {
        const infra = await getInfrastructure();
        const results = await infra.market.getScreenerData(type, count);

        // Limit results and return
        return NextResponse.json(results);
    } catch (error) {
        console.error('Error in market scan API:', error);
        return NextResponse.json({ error: 'Failed to fetch scan results' }, { status: 500 });
    }
}
