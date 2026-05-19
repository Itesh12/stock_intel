import React from "react";
import { getInfrastructure } from "@/infrastructure/container";
import { NewsService } from "@/application/news-service";
import NewsIntelligenceClient from "./news-client";

export const dynamic = 'force-dynamic';

export default async function NewsIntelligencePage() {
    const infra = await getInfrastructure();
    const newsService = new NewsService(infra.market);

    const { items: news, hasMore } = await newsService.getMarketWideNews(10, 0);
    const aggregate = newsService.getAggregateSentiment(news);

    return <NewsIntelligenceClient initialNews={news} initialAggregate={aggregate} initialHasMore={hasMore} />;
}
