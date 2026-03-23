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

    public async getMarketWideNews(count: number = 20, offset: number = 0): Promise<AnalyzedNewsItem[]> {
        // Fetch news for broad market contexts
        const contexts = ["NIFTY 50", "Indian Stock Market", "NSE", "Indian Economy"];
        
        // Use a larger count per context to allow for better aggregation and pagination
        const perContext = Math.min(20, count + offset);
        const allNewsPromises = contexts.map(context => this.marketRepo.getNews(context, perContext));
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

        // Sort by time descending if available
        uniqueNews.sort((a, b) => (b.providerPublishTime || 0) - (a.providerPublishTime || 0));

        // Analyze and format with pagination
        return uniqueNews.slice(offset, offset + count).map(item => {
            // If summary is missing, use title or a better fallback
            let summary = item.summary || "";
            if (!summary || summary === "No summary available for this market event.") {
                summary = `Latest report from ${item.publisher || 'market experts'} regarding ${item.title.toLowerCase()}. Stay updated with real-time market shifts.`;
            }

            const sentiment = this.calculateSentiment(item.title || "", summary);
            
            // Fix timestamp: Yahoo Finance returns seconds or milliseconds. 
            // If it's less than 10^12, it's likely seconds.
            const pubTime = item.providerPublishTime || Date.now() / 1000;
            const timeMs = pubTime < 10000000000 ? pubTime * 1000 : pubTime;

            return {
                title: item.title || "Market Update",
                summary,
                source: item.publisher || item.source?.name || "Market Source",
                url: item.link || "#",
                time: new Date(timeMs).toISOString(),
                sentiment,
                relatedSymbols: item.relatedTickers || []
            };
        });
    }

    public getAggregateSentiment(news: AnalyzedNewsItem[]) {
        if (news.length === 0) return { score: 0, label: 'NEUTRAL', bullishCount: 0, bearishCount: 0, neutralCount: 0, confidence: 0 };

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
