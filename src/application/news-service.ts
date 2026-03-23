import { MarketDataPort } from "../ports/market-data-port";

export interface NewsSentiment {
    score: number;
    label: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    reasoning: string;
}

export interface AnalyzedNewsItem {
    title: string;
    summary: string;
    source: string;
    url: string;
    time: string;
    sentiment: NewsSentiment;
    relatedSymbols?: string[];
}

export class NewsService {
    constructor(private marketRepo: MarketDataPort) {}

    public calculateSentiment(title: string, summary: string): NewsSentiment {
        const text = (title + " " + summary).toLowerCase();
        
        const bullishKeywords = [
            'buy', 'growth', 'profit', 'surged', 'bullish', 'dividend', 'expand', 
            'success', 'outperform', 'upgrade', 'high', 'win', 'positive', 'rally',
            'recovery', 'gain', 'strong', 'optimistic', 'beats', 'soared'
        ];
        const bearishKeywords = [
            'sell', 'loss', 'drop', 'slashed', 'bearish', 'debt', 'risk', 
            'fail', 'underperform', 'downgrade', 'low', 'negative', 'crash', 
            'concern', 'slump', 'plunge', 'weak', 'pessimistic', 'misses', 'debt'
        ];

        let score = 0;
        bullishKeywords.forEach(word => { if (text.includes(word)) score += 1; });
        bearishKeywords.forEach(word => { if (text.includes(word)) score -= 1; });

        let label: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
        let reasoning = "AI detected a balanced market narrative with neutral sentiment signals.";

        if (score > 1) {
            label = 'BULLISH';
            reasoning = `Strong positive momentum detected with ${score} bullish indicator signals.`;
        } else if (score < -1) {
            label = 'BEARISH';
            reasoning = `Significant bearish signals (${Math.abs(score)}) identified, indicating potential downward pressure.`;
        } else if (score === 1) {
            label = 'BULLISH';
            reasoning = "Slightly positive bias observed in current market reporting.";
        } else if (score === -1) {
            label = 'BEARISH';
            reasoning = "Slightly cautious or negative sentiment detected in the news flow.";
        }

        return { score, label, reasoning };
    }

    public async getMarketWideNews(count: number = 20): Promise<AnalyzedNewsItem[]> {
        // Fetch news for broad market contexts
        const contexts = ["NIFTY 50", "Indian Stock Market", "NSE", "Indian Economy"];
        
        const allNewsPromises = contexts.map(context => this.marketRepo.getNews(context, 10));
        const allNewsResults = await Promise.all(allNewsPromises);
        
        // Flatten and de-duplicate by URL
        const seenUrls = new Set<string>();
        const uniqueNews: any[] = [];
        
        allNewsResults.flat().forEach(item => {
            if (item.link && !seenUrls.has(item.link)) {
                seenUrls.add(item.link);
                uniqueNews.push(item);
            }
        });

        // Analyze and format
        return uniqueNews.slice(0, count).map(item => {
            const sentiment = this.calculateSentiment(item.title || "", item.summary || "");
            return {
                title: item.title || "Untitled Intelligence",
                summary: item.summary || "No summary available for this market event.",
                source: item.publisher || item.source?.name || "Market Source",
                url: item.link || "#",
                time: item.providerPublishTime 
                    ? new Date(item.providerPublishTime * 1000).toISOString() 
                    : new Date().toISOString(),
                sentiment,
                relatedSymbols: item.relatedTickers || []
            };
        });
    }

    public getAggregateSentiment(news: AnalyzedNewsItem[]) {
        if (news.length === 0) return { score: 0, label: 'NEUTRAL', bullishCount: 0, bearishCount: 0, neutralCount: 0 };

        const bullish = news.filter(n => n.sentiment.label === 'BULLISH').length;
        const bearish = news.filter(n => n.sentiment.label === 'BEARISH').length;
        const neutral = news.length - bullish - bearish;

        const score = (bullish - bearish) / news.length;

        return {
            score,
            label: score > 0.1 ? 'BULLISH' : score < -0.1 ? 'BEARISH' : 'NEUTRAL',
            bullishCount: bullish,
            bearishCount: bearish,
            neutralCount: neutral,
            confidence: Math.min(Math.abs(score) * 100 + 40, 98)
        };
    }
}
