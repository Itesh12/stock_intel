import { NextRequest, NextResponse } from "next/server";
import { getInfrastructure } from "@/infrastructure/container";

function calculateSentiment(title: string, summary: string): { score: number, label: 'BULLISH' | 'BEARISH' | 'NEUTRAL', reasoning: string } {
    const text = (title + " " + summary).toLowerCase();
    
    const bullishKeywords = ['buy', 'growth', 'profit', 'surged', 'bullish', 'dividend', 'expand', 'success', 'outperform', 'upgrade', 'high', 'win', 'positive'];
    const bearishKeywords = ['sell', 'loss', 'drop', 'slashed', 'bearish', 'debt', 'risk', 'fail', 'underperform', 'downgrade', 'low', 'negative', 'crash', 'concern'];

    let score = 0;
    bullishKeywords.forEach(word => { if (text.includes(word)) score += 1; });
    bearishKeywords.forEach(word => { if (text.includes(word)) score -= 1; });

    let label: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    let reasoning = "Balanced market sentiment based on recent news flow.";

    if (score > 0) {
        label = 'BULLISH';
        reasoning = `AI detected positive momentum signals and growth-oriented keywords (${score} signals).`;
    } else if (score < 0) {
        label = 'BEARISH';
        reasoning = `AI identified structural risks and pessimistic keyword patterns (${Math.abs(score)} signals).`;
    }

    return { score, label, reasoning };
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const symbol = searchParams.get('symbol');
        if (!symbol) return NextResponse.json({ error: "Symbol required" }, { status: 400 });

        const infra = await getInfrastructure();
        const news = await infra.market.getNews(symbol, 10);

        const analyzedNews = news.map((item: any) => {
            const sentiment = calculateSentiment(item.title || "", item.summary || "");
            return {
                ...item,
                sentiment
            };
        });

        // Calculate overall aggregate sentiment
        const scores = analyzedNews.map((n: any) => n.sentiment.score);
        const avgScore = scores.reduce((a: number, b: number) => a + b, 0) / (scores.length || 1);
        
        const aggregate = {
            score: avgScore,
            label: avgScore > 0.5 ? 'BULLISH' : avgScore < -0.5 ? 'BEARISH' : 'NEUTRAL',
            confidence: Math.min(Math.abs(avgScore) * 20 + 50, 95) // Mock confidence
        };

        return NextResponse.json({
            news: analyzedNews,
            aggregate
        });

    } catch (err) {
        console.error("News API failed", err);
        return NextResponse.json({ error: "Failed to analyze news" }, { status: 500 });
    }
}
