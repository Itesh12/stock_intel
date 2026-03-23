import { NextResponse } from 'next/server';
import { getInfrastructure } from '@/infrastructure/container';

export async function GET() {
    try {
        const infra = await getInfrastructure();
        const indices = ["^NSEI", "^BSESN"];
        const data = await Promise.all(
            indices.map(symbol => infra.market.getStockPrice(symbol))
        );

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error fetching indices:', error);
        return NextResponse.json({ error: 'Failed to fetch indices' }, { status: 500 });
    }
}
