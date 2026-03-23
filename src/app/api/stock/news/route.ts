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
        
        // Fetch stock info to get the proper name for strict filtering
        const stockInfo = await infra.market.getStockPrice(symbol);
        const companyName = stockInfo.name || "";
        const news = await infra.market.getNews(symbol, 40); // Fetch more so we have enough after filtering

        // Extract key name components for filtering (e.g. "Reliance Industries" -> ["reliance", "industries"])
        const nameKeywords = companyName.toLowerCase()
            .replace(/limited|corp|inc|ltd|co|plc/gi, '')
            .split(/[\s,.-]+/)
            .filter(word => word.length > 3);
            
        const symbolBase = symbol.split('.')[0].toLowerCase();

        const filteredNews = news.filter((item: any) => {
            const title = (item.title || "").toLowerCase();
            const summary = (item.summary || "").toLowerCase();
            
            // Check if symbol or any significant name keyword is present
            const matchesSymbol = title.includes(symbolBase) || summary.includes(symbolBase);
            const matchesName = nameKeywords.some(keyword => title.includes(keyword) || summary.includes(keyword));
            
            return matchesSymbol || matchesName;
        }).slice(0, 10); // Limit to top 10 relevant items

        const analyzedNews = filteredNews.map((item: any) => {
            const sentiment = calculateSentiment(item.title || "", item.summary || "");
            return {
                ...item,
                sentiment
            };
        });

        // Calculate overall aggregate sentiment
        const scores = analyzedNews.map((n: any) => n.sentiment.score);
        const avgScore = scores.length > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 0;
        
        // Confidence based on signal consensus
        const variance = scores.length > 1 
            ? scores.reduce((a, b) => a + Math.pow(b - avgScore, 2), 0) / scores.length 
            : 0;
        
        const confidence = Math.max(40, Math.min(95, 80 - (variance * 20) + (analyzedNews.length * 2)));

        const aggregate = {
            score: avgScore,
            label: avgScore > 0.5 ? 'BULLISH' : avgScore < -0.5 ? 'BEARISH' : 'NEUTRAL',
            confidence: confidence,
            rationale: analyzedNews.length > 0 
                ? `Our aggregate analysis of ${analyzedNews.length} recent signals indicates a ${avgScore > 0 ? 'strengthening' : 'stable'} ${avgScore > 0.5 ? 'bullish' : 'neutral'} bias.`
                : "Limited news flow detected. Market sentiment remains calibrated to baseline levels."
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
