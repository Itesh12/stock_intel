import { Infrastructure } from "../infrastructure/container";
import { Strategy, StrategyRecommendation } from "../domain/strategy";
import { v4 as uuidv4 } from "uuid";

export class CanslimScanner {
    constructor(private infra: Infrastructure) { }

    async scan(): Promise<StrategyRecommendation[]> {
        const strategy = await this.infra.strategy.findBySlug('canslim');
        if (!strategy) return [];

        console.log("[QuantScanner] Starting CANSLIM scan...");

        // 1. Get a pool of potential stocks to scan
        let discoveryPool: string[] = [];
        try {
            const fs = await import("fs");
            const path = await import("path");
            const symbolsPath = path.join(process.cwd(), 'src/data/indian-symbols.json');
            const allSymbols = JSON.parse(fs.readFileSync(symbolsPath, 'utf8'));

            // Randomly sample 300 symbols for broader algorithmic discovery
            discoveryPool = allSymbols
                .sort(() => 0.5 - Math.random())
                .slice(0, 300);
        } catch (err) {
            console.error("[QuantScanner] Failed to load discovery pool:", err);
        }

        const pools = await Promise.all([
            this.infra.market.getScreenerData('most_actives', 50),
            this.infra.market.getScreenerData('day_gainers', 50),
            this.infra.market.getScreenerData('day_losers', 50)
        ]);

        const uniqueSymbols = Array.from(new Set([
            ...discoveryPool,
            ...pools.flat().map(s => s.symbol).filter(Boolean) as string[]
        ]));

        console.log(`[QuantScanner] Evaluating ${uniqueSymbols.length} candidates via algorithmic sampler...`);

        const recommendations: StrategyRecommendation[] = [];

        // 2. Evaluate candidates in parallel batches
        const batchSize = 20;
        let evaluatedCount = 0;
        for (let i = 0; i < uniqueSymbols.length; i += batchSize) {
            const batch = uniqueSymbols.slice(i, i + batchSize);
            await Promise.all(batch.map(async (symbol) => {
                try {
                    const stock = await this.infra.market.getStockPrice(symbol);
                    if (!stock || !stock.price) return;
                    evaluatedCount++;

                    // CANSLIM Criteria Mapping (Modulated for broader discovery)
                    const earningsGrowth = (stock.earningsGrowth || 0) * 100;
                    const revenueGrowth = (stock.revenueGrowth || 0) * 100;
                    const c_pass = earningsGrowth >= 15 || revenueGrowth >= 10;

                    const roe = (stock.roe || 0) * 100;
                    const a_pass = roe >= 10;

                    const fiftyTwoWeekHigh = stock.fiftyTwoWeekHigh || stock.price || 0;
                    const distanceToHigh = stock.price && fiftyTwoWeekHigh ? (stock.price / fiftyTwoWeekHigh) : 0;
                    const n_pass = distanceToHigh >= 0.75;

                    const s_pass = (stock.marketCap || 0) >= 500000000; // 50Cr+
                    const l_pass = (stock.changePercent || 0) > -5; // Momentum
                    const i_pass = (stock.institutionOwnership || 0) >= 0; // Institution scan


                    let score = 0;
                    if (c_pass) score += 25;
                    if (a_pass) score += 20;
                    if (n_pass) score += 20;
                    if (s_pass) score += 15;
                    if (l_pass) score += 10;
                    if (i_pass) score += 10;

                    if (score >= 30) {
                        recommendations.push({
                            id: uuidv4(),
                            strategyId: strategy.id,
                            symbol: symbol,
                            score: score,
                            matchDetails: {
                                earningsGrowth,
                                revenueGrowth,
                                roe,
                                distanceToHigh,
                                institutionOwnership: stock.institutionOwnership
                            },
                            timestamp: new Date()
                        });
                    }
                } catch (err) {
                    // Ignore errors for individual stocks
                }
            }));
        }

        // 3. Sort by score and take top 10
        const topRecs = recommendations.sort((a, b) => b.score - a.score).slice(0, 10);

        // 4. Save to DB
        await this.infra.strategy.saveRecommendations(strategy.id, topRecs);

        console.log(`[QuantScanner] Scan complete. Evaluated ${evaluatedCount} stocks. Found ${topRecs.length} matches.`);
        return topRecs;
    }
}
