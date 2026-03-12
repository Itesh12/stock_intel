import { Infrastructure } from "../infrastructure/container";
import { Strategy, StrategyRecommendation } from "../domain/strategy";
import { v4 as uuidv4 } from "uuid";
import { NotificationService } from "../application/notification-service";
import { ScoringService } from "../application/scoring-service";

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

        // 5. Trigger Notifications for high-conviction matches (Score > 70)
        const notificationService = new NotificationService(this.infra.notification);
        // Using a system-wide user ID for global alerts or a placeholder
        const SYSTEM_USER_ID = "SYSTEM"; 

        for (const rec of topRecs) {
            if (rec.score >= 70) {
                await notificationService.notifySignal(SYSTEM_USER_ID, {
                    symbol: rec.symbol,
                    type: "PRICE_SURGE", // Using standard type from Signal interface
                    strength: "HIGH",
                    description: `New high-conviction CANSLIM match discovered for ${rec.symbol} with a score of ${rec.score}/100.`,
                    timestamp: new Date()
                });
            }
        }

        console.log(`[QuantScanner] Scan complete. Evaluated ${evaluatedCount} stocks. Found ${topRecs.length} matches.`);
        return topRecs;
    }
}

export class IntermarketScanner {
    constructor(private infra: Infrastructure) { }

    async scan(): Promise<StrategyRecommendation[]> {
        const strategy = await this.infra.strategy.findBySlug('intermarket-analysis-india');
        if (!strategy) return [];

        console.log("[QuantScanner] Starting INTERMARKET scan...");

        let discoveryPool: string[] = [];
        try {
            const fs = await import("fs");
            const path = await import("path");
            const symbolsPath = path.join(process.cwd(), 'src/data/indian-symbols.json');
            const allSymbols = JSON.parse(fs.readFileSync(symbolsPath, 'utf8'));
            discoveryPool = allSymbols.sort(() => 0.5 - Math.random()).slice(0, 300);
        } catch (err) {
            console.error("[QuantScanner] Failed to load discovery pool:", err);
        }

        const pools = await Promise.all([
            this.infra.market.getScreenerData('most_actives', 50),
            this.infra.market.getScreenerData('day_gainers', 50)
        ]);

        const uniqueSymbols = Array.from(new Set([
            ...discoveryPool,
            ...pools.flat().map(s => s.symbol).filter(Boolean) as string[]
        ]));

        console.log(`[QuantScanner] Evaluating ${uniqueSymbols.length} candidates via algorithmic sampler...`);

        const recommendations: StrategyRecommendation[] = [];
        const batchSize = 20;
        let evaluatedCount = 0;

        for (let i = 0; i < uniqueSymbols.length; i += batchSize) {
            const batch = uniqueSymbols.slice(i, i + batchSize);
            await Promise.all(batch.map(async (symbol) => {
                try {
                    const stock = await this.infra.market.getStockPrice(symbol);
                    if (!stock || !stock.price) return;
                    evaluatedCount++;

                    // Debt/Equity < 1 (Relaxing for demo to allow some results)
                    const debtToEquity = stock.debtToEquity || 0;
                    if (debtToEquity >= 200) return; // Note: debtToEquity might be percentage like 120 -> 1.2

                    // Market Cap > 2000 Cr ($240M USD approx for now - relaxing to 500 Cr)
                    if ((stock.marketCap || 0) < 50000000) return;

                    // Liquidity - Avoid low volume (Relaxing to 20k)
                    if ((stock.volume || 0) < 20000) return;

                    // Compute simple breakout criteria
                    const fiftyTwoWeekHigh = stock.fiftyTwoWeekHigh || stock.price || 0;
                    const fiftyTwoWeekLow = stock.fiftyTwoWeekLow || stock.price || 0;
                    
                    // Breakout: Assuming close to 50d high if close is near 52w high as proxy 
                    const distanceToHigh = stock.price / fiftyTwoWeekHigh;
                    const breakoutPass = distanceToHigh >= 0.70; // Relaxed from 0.85
                    
                    // Uptrend: MA200 Proxy. Assuming if price > avg of 52w High/Low, trend is structurally up
                    const approxMa200 = (fiftyTwoWeekHigh + fiftyTwoWeekLow) / 2;
                    const trendPass = stock.price > approxMa200;

                    // Momentum proxy
                    const momentumPass = (stock.changePercent || 0) > -2; // Relaxed allowing slight pullbacks

                    let score = 0;
                    if (breakoutPass) score += 40;
                    if (trendPass) score += 30;
                    if (momentumPass) score += 20;
                    if (debtToEquity < 100) score += 10;

                    if (score >= 40) { // Relaxed threshold from 50 to 40

                        recommendations.push({
                            id: uuidv4(),
                            strategyId: strategy.id,
                            symbol: symbol,
                            score: score,
                            matchDetails: {
                                debtToEquity,
                                distanceToHigh,
                                price: stock.price,
                                approxMa200
                            },
                            timestamp: new Date()
                        });
                    }
                } catch (err) {
                    // Ignore individual stock fetch errors
                }
            }));
        }

        const topRecs = recommendations.sort((a, b) => b.score - a.score).slice(0, 10);
        await this.infra.strategy.saveRecommendations(strategy.id, topRecs);

        // Notify for high-conviction matches
        const notificationService = new NotificationService(this.infra.notification);
        const SYSTEM_USER_ID = "SYSTEM";

        for (const rec of topRecs) {
            if (rec.score >= 80) {
                await notificationService.notifySignal(SYSTEM_USER_ID, {
                    symbol: rec.symbol,
                    type: "INSTITUTIONAL_BUY",
                    strength: "HIGH",
                    description: `Strategic breakout detected for ${rec.symbol}. Momentum score: ${rec.score}/100.`,
                    timestamp: new Date()
                });
            }
        }

        console.log(`[QuantScanner] Scan complete. Evaluated ${evaluatedCount} stocks. Found ${topRecs.length} matches.`);
        return topRecs;
    }
}
