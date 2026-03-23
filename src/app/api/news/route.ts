import { NextRequest, NextResponse } from "next/server";
import { getInfrastructure } from "@/infrastructure/container";
import { NewsService } from "@/application/news-service";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const infra = await getInfrastructure();
        const newsService = new NewsService(infra.market);

        const news = await newsService.getMarketWideNews(20);
        const aggregate = newsService.getAggregateSentiment(news);

        return NextResponse.json({
            news,
            aggregate,
            lastSync: new Date().toISOString()
        });

    } catch (err) {
        console.error("General News API failed", err);
        return NextResponse.json({ error: "Failed to fetch market news" }, { status: 500 });
    }
}
