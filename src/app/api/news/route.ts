import { NextRequest, NextResponse } from "next/server";
import { getInfrastructure } from "@/infrastructure/container";
import { NewsService } from "@/application/news-service";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const count = parseInt(searchParams.get('count') || '10');
        const offset = parseInt(searchParams.get('offset') || '0');
        const date = searchParams.get('date') || undefined;
        const sentiment = searchParams.get('sentiment') || undefined;

        const infra = await getInfrastructure();
        const newsService = new NewsService(infra.market);

        const { items: news, hasMore } = await newsService.getMarketWideNews(count, offset, date, sentiment);
        const aggregate = newsService.getAggregateSentiment(news);

        return NextResponse.json({
            news,
            aggregate,
            hasMore,
            lastSync: new Date().toISOString()
        });

    } catch (err) {
        console.error("General News API failed", err);
        return NextResponse.json({ error: "Failed to fetch market news" }, { status: 500 });
    }
}
