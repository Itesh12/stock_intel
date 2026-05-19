import { Infrastructure } from "../infrastructure/container";
import { Strategy, StrategyRecommendation } from "../domain/strategy";
import { v4 as uuidv4 } from "uuid";
import { NotificationService } from "../application/notification-service";
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

// Helper to chunk an array into batch groups
function chunkArray<T>(array: T[], size: number): T[][] {
    const chunked: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunked.push(array.slice(i, i + size));
    }
    return chunked;
}

// Parallel Pool Task Runner to process deep queries concurrently
async function parallelPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
    const results: R[] = [];
    const promises = items.map((item, index) => async () => {
        results[index] = await fn(item);
    });
    const workers = Array.from({ length: limit }, async () => {
        while (promises.length > 0) {
            const task = promises.shift();
            if (task) await task();
        }
    });
    await Promise.all(workers);
    return results;
}

export class CanslimScanner {
    constructor(private infra: Infrastructure) { }

    async scan(): Promise<StrategyRecommendation[]> {
        const strategy = await this.infra.strategy.findBySlug('canslim');
        if (!strategy) return [];

        console.log("[QuantScanner] Starting CANSLIM batch scan...");

        // 1. Get all symbols
        let discoveryPool: string[] = [];
        try {
            const fs = await import("fs");
            const path = await import("path");
            const symbolsPath = path.join(process.cwd(), 'src/data/indian-symbols.json');
            const allSymbols = JSON.parse(fs.readFileSync(symbolsPath, 'utf8'));
            discoveryPool = allSymbols;
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
        ])).filter(sym => sym.endsWith('.NS'));

        console.log(`[QuantScanner] Querying basic quotes for ${uniqueSymbols.length} stocks in batch chunks...`);

        // Batch query Yahoo Finance basic quotes in chunks of 150 (takes ~1-2 seconds total!)
        const chunks = chunkArray(uniqueSymbols, 150);
        const liveBasicQuotes: any[] = [];

        await Promise.all(chunks.map(async (chunk) => {
            try {
                const batchResult = await yahooFinance.quote(chunk, undefined, { validateResult: false });
                const quotes = Array.isArray(batchResult) ? batchResult : [batchResult];
                liveBasicQuotes.push(...quotes.filter(Boolean));
            } catch (err) {
                // Ignore chunk failures
            }
        }));

        console.log(`[QuantScanner] Loaded ${liveBasicQuotes.length} live quotes from Yahoo Finance. Pre-screening...`);

        // Pre-screening filters (penny stocks, liquidity, market cap)
        // CANSLIM: Market Cap >= 3000 Cr, volume > 10,000, price > 5 INR
        const candidates = liveBasicQuotes.filter(q => {
            const price = q.regularMarketPrice || 0;
            const marketCap = q.marketCap || 0;
            const volume = q.regularMarketVolume || 0;
            const changePercent = q.regularMarketChangePercent || 0;

            const isLiquid = volume >= 10000;
            const isNotPenny = price >= 5;
            const isSizable = marketCap >= 30000000000; // 3000 Cr
            const hasMomentum = changePercent > -5;

            return isLiquid && isNotPenny && isSizable && hasMomentum;
        });

        console.log(`[QuantScanner] Pre-screened down to ${candidates.length} high-probability CANSLIM candidates. Evaluating deep summary details...`);

        const recommendations: StrategyRecommendation[] = [];
        let evaluatedCount = 0;

        // Run deep evaluation using parallelPool concurrency limit of 35 workers to fetch full stats
        await parallelPool(candidates, 35, async (candidateQuote) => {
            const symbol = candidateQuote.symbol;
            try {
                const summaryRes = await yahooFinance.quoteSummary(symbol, {
                    modules: ['defaultKeyStatistics', 'financialData', 'summaryDetail']
                }, { validateResult: false }).catch(() => null);

                if (!summaryRes) return;
                evaluatedCount++;

                const summary = summaryRes as any || {};
                const financialData = summary.financialData || {};
                const keyStats = summary.defaultKeyStatistics || {};

                // Use live data from both basic quote and deep summary!
                const roe = (financialData.returnOnEquity || 0) * 100;
                const earningsGrowth = (financialData.earningsGrowth || 0) * 100;
                const revenueGrowth = (financialData.revenueGrowth || 0) * 100;

                const c_pass = earningsGrowth >= 15 || revenueGrowth >= 10;
                const a_pass = roe >= 10;

                const fiftyTwoWeekHigh = candidateQuote.fiftyTwoWeekHigh || candidateQuote.regularMarketPrice || 0;
                const distanceToHigh = candidateQuote.regularMarketPrice && fiftyTwoWeekHigh ? (candidateQuote.regularMarketPrice / fiftyTwoWeekHigh) : 0;
                const n_pass = distanceToHigh >= 0.75;

                const s_pass = (candidateQuote.marketCap || 0) >= 30000000000;
                const l_pass = (candidateQuote.regularMarketChangePercent || 0) > -5;
                const i_pass = (keyStats.heldPercentInstitutions || 0) >= 0;

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
                            institutionOwnership: keyStats.heldPercentInstitutions
                        },
                        timestamp: new Date()
                    });
                }
            } catch (err) {
                // Ignore individual stock errors
            }
        });

        // Sort by score and take top 10
        const topRecs = recommendations.sort((a, b) => b.score - a.score).slice(0, 10);

        // Save to DB
        await this.infra.strategy.saveRecommendations(strategy.id, topRecs);

        // Trigger Notifications for high-conviction matches (Score > 70)
        const notificationService = new NotificationService(this.infra.notification);
        const SYSTEM_USER_ID = "SYSTEM";

        for (const rec of topRecs) {
            if (rec.score >= 70) {
                await notificationService.notifySignal(SYSTEM_USER_ID, {
                    symbol: rec.symbol,
                    type: "PRICE_SURGE",
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

        console.log("[QuantScanner] Starting INTERMARKET batch scan...");

        let discoveryPool: string[] = [];
        try {
            const fs = await import("fs");
            const path = await import("path");
            const symbolsPath = path.join(process.cwd(), 'src/data/indian-symbols.json');
            const allSymbols = JSON.parse(fs.readFileSync(symbolsPath, 'utf8'));
            discoveryPool = allSymbols;
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
        ])).filter(sym => sym.endsWith('.NS'));

        console.log(`[QuantScanner] Querying basic quotes for ${uniqueSymbols.length} stocks in batch chunks...`);

        // Batch query Yahoo Finance basic quotes
        const chunks = chunkArray(uniqueSymbols, 150);
        const liveBasicQuotes: any[] = [];

        await Promise.all(chunks.map(async (chunk) => {
            try {
                const batchResult = await yahooFinance.quote(chunk, undefined, { validateResult: false });
                const quotes = Array.isArray(batchResult) ? batchResult : [batchResult];
                liveBasicQuotes.push(...quotes.filter(Boolean));
            } catch (err) {
                // Ignore chunk failures
            }
        }));

        console.log(`[QuantScanner] Loaded ${liveBasicQuotes.length} live quotes from Yahoo Finance. Pre-screening...`);

        // Pre-screening filters (penny stocks, liquidity, market cap, breakout momentum)
        // Intermarket: Market Cap >= 3000 Cr, Volume >= 20,000, Price >= 5, changePercent > -2
        const candidates = liveBasicQuotes.filter(q => {
            const price = q.regularMarketPrice || 0;
            const marketCap = q.marketCap || 0;
            const volume = q.regularMarketVolume || 0;
            const changePercent = q.regularMarketChangePercent || 0;

            const isLiquid = volume >= 20000;
            const isNotPenny = price >= 5;
            const isSizable = marketCap >= 30000000000; // 3000 Cr
            const hasMomentum = changePercent > -2;

            const fiftyTwoWeekHigh = q.fiftyTwoWeekHigh || price || 0;
            const distanceToHigh = price / fiftyTwoWeekHigh;
            const breakoutPass = distanceToHigh >= 0.70;

            return isLiquid && isNotPenny && isSizable && hasMomentum && breakoutPass;
        });

        console.log(`[QuantScanner] Pre-screened down to ${candidates.length} high-probability INTERMARKET candidates. Evaluating deep summary details...`);

        const recommendations: StrategyRecommendation[] = [];
        let evaluatedCount = 0;

        await parallelPool(candidates, 35, async (candidateQuote) => {
            const symbol = candidateQuote.symbol;
            try {
                const summaryRes = await yahooFinance.quoteSummary(symbol, {
                    modules: ['defaultKeyStatistics', 'financialData', 'summaryDetail']
                }, { validateResult: false }).catch(() => null);

                if (!summaryRes) return;
                evaluatedCount++;

                const summary = summaryRes as any || {};
                const financialData = summary.financialData || {};

                const debtToEquity = financialData.debtToEquity || 0;
                if (debtToEquity >= 200) return;

                const fiftyTwoWeekHigh = candidateQuote.fiftyTwoWeekHigh || candidateQuote.regularMarketPrice || 0;
                const fiftyTwoWeekLow = candidateQuote.fiftyTwoWeekLow || candidateQuote.regularMarketPrice || 0;

                const distanceToHigh = candidateQuote.regularMarketPrice / fiftyTwoWeekHigh;
                const breakoutPass = distanceToHigh >= 0.70;

                const approxMa200 = (fiftyTwoWeekHigh + fiftyTwoWeekLow) / 2;
                const trendPass = candidateQuote.regularMarketPrice > approxMa200;
                const momentumPass = (candidateQuote.regularMarketChangePercent || 0) > -2;

                let score = 0;
                if (breakoutPass) score += 40;
                if (trendPass) score += 30;
                if (momentumPass) score += 20;
                if (debtToEquity < 100) score += 10;

                if (score >= 40) {
                    recommendations.push({
                        id: uuidv4(),
                        strategyId: strategy.id,
                        symbol: symbol,
                        score: score,
                        matchDetails: {
                            debtToEquity,
                            distanceToHigh,
                            price: candidateQuote.regularMarketPrice,
                            approxMa200
                        },
                        timestamp: new Date()
                    });
                }
            } catch (err) {
                // Ignore individual stock errors
            }
        });

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

export class BuffetScanner {
    constructor(private infra: Infrastructure) { }

    async scan(): Promise<StrategyRecommendation[]> {
        const strategy = await this.infra.strategy.findBySlug('warren-buffet');
        if (!strategy) return [];

        console.log("[QuantScanner] Starting WARREN BUFFET (IVCF) batch scan...");

        let discoveryPool: string[] = [];
        try {
            const fs = await import("fs");
            const path = await import("path");
            const symbolsPath = path.join(process.cwd(), 'src/data/indian-symbols.json');
            const allSymbols = JSON.parse(fs.readFileSync(symbolsPath, 'utf8'));
            discoveryPool = allSymbols;
        } catch (err) {
            console.error("[QuantScanner] Failed to load discovery pool:", err);
        }

        const pools = await Promise.all([
            this.infra.market.getScreenerData('most_actives', 50),
            this.infra.market.getScreenerData('undervalued_growth_stocks', 50)
        ]);

        const uniqueSymbols = Array.from(new Set([
            ...discoveryPool,
            ...pools.flat().map(s => s.symbol).filter(Boolean) as string[]
        ])).filter(sym => sym.endsWith('.NS'));

        console.log(`[QuantScanner] Querying basic quotes for ${uniqueSymbols.length} stocks in batch chunks...`);

        // Batch query Yahoo Finance basic quotes
        const chunks = chunkArray(uniqueSymbols, 150);
        const liveBasicQuotes: any[] = [];

        await Promise.all(chunks.map(async (chunk) => {
            try {
                const batchResult = await yahooFinance.quote(chunk, undefined, { validateResult: false });
                const quotes = Array.isArray(batchResult) ? batchResult : [batchResult];
                liveBasicQuotes.push(...quotes.filter(Boolean));
            } catch (err) {
                // Ignore chunk failures
            }
        }));

        console.log(`[QuantScanner] Loaded ${liveBasicQuotes.length} live quotes from Yahoo Finance. Pre-screening...`);

        // Pre-screening filters (penny stocks, liquidity, market cap)
        // Buffet: Market Cap >= 3000 Cr, Volume >= 10,000, Price >= 5, PE < 50
        const candidates = liveBasicQuotes.filter(q => {
            const price = q.regularMarketPrice || 0;
            const marketCap = q.marketCap || 0;
            const volume = q.regularMarketVolume || 0;
            const pe = q.trailingPE || 25;

            const isLiquid = volume >= 10000;
            const isNotPenny = price >= 5;
            const isSizable = marketCap >= 30000000000; // 3000 Cr
            const isReasonablePE = pe < 50;

            return isLiquid && isNotPenny && isSizable && isReasonablePE;
        });

        console.log(`[QuantScanner] Pre-screened down to ${candidates.length} high-probability BUFFET candidates. Evaluating deep summary details...`);

        const recommendations: StrategyRecommendation[] = [];
        let evaluatedCount = 0;

        await parallelPool(candidates, 35, async (candidateQuote) => {
            const symbol = candidateQuote.symbol;
            try {
                const summaryRes = await yahooFinance.quoteSummary(symbol, {
                    modules: ['defaultKeyStatistics', 'financialData', 'summaryDetail']
                }, { validateResult: false }).catch(() => null);

                if (!summaryRes) return;
                evaluatedCount++;

                const summary = summaryRes as any || {};
                const financialData = summary.financialData || {};
                const keyStats = summary.defaultKeyStatistics || {};

                const roe = (financialData.returnOnEquity || 0) * 100;
                const opm = (financialData.operatingMargins || 0) * 100;
                const roa = (financialData.returnOnAssets || 0) * 100;

                const isBank = candidateQuote.sector?.toLowerCase().includes('bank') || candidateQuote.sector?.toLowerCase().includes('finance');
                const q_val = isBank ? (roe + roa * 5) / 2 : (roe + (roe * 1.1) + opm) / 3;
                const q_score = Math.min(100, (q_val / 15) * 100);

                const m_score = Math.min(100, ((candidateQuote.marketCap || 0) / 1000000000) * 10 + (opm > 20 ? 40 : 20));

                const de = financialData.debtToEquity || 0;
                const f_score = Math.max(0, 100 - de);

                const pe = candidateQuote.trailingPE || 25;
                const v_score = pe < 15 ? 100 : pe < 25 ? 90 : pe < 40 ? 80 : 60;

                const revGrowth = (financialData.revenueGrowth || 0) * 100;
                const epsGrowth = (financialData.earningsGrowth || 0) * 100;
                const g_score = Math.min(100, (revGrowth + epsGrowth) / 2 * 4);

                const totalScore = Math.round(
                    (0.25 * q_score) +
                    (0.20 * m_score) +
                    (0.20 * f_score) +
                    (0.20 * v_score) +
                    (0.15 * g_score)
                );

                const passesROE = roe > 15;
                const passesDE = de < 50;

                if (totalScore >= 65 || (passesROE && passesDE)) {
                    recommendations.push({
                        id: uuidv4(),
                        strategyId: strategy.id,
                        symbol: symbol,
                        score: totalScore,
                        matchDetails: {
                            q_score,
                            m_score,
                            f_score,
                            v_score,
                            g_score,
                            roe,
                            de,
                            pe
                        },
                        timestamp: new Date()
                    });
                }
            } catch (err) {
                // Ignore individual stock errors
            }
        });

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
                    description: `New Indian Buffett Compounder detected: ${rec.symbol}. IVCF Score: ${rec.score}/100.`,
                    timestamp: new Date()
                });
            }
        }

        console.log(`[QuantScanner] Scan complete. Evaluated ${evaluatedCount} stocks. Found ${topRecs.length} matches.`);
        return topRecs;
    }
}

export class IntradayScanner {
    constructor(private infra: Infrastructure) { }

    async scan(): Promise<StrategyRecommendation[]> {
        const strategy = await this.infra.strategy.findBySlug('intraday-strategy');
        if (!strategy) return [];

        console.log("[QuantScanner] Starting INTRADAY CONFLUENCE batch scan...");

        let discoveryPool: string[] = [];
        try {
            const fs = await import("fs");
            const path = await import("path");
            const symbolsPath = path.join(process.cwd(), 'src/data/indian-symbols.json');
            const allSymbols = JSON.parse(fs.readFileSync(symbolsPath, 'utf8'));
            discoveryPool = allSymbols;
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
        ])).filter(sym => sym.endsWith('.NS'));

        console.log(`[QuantScanner] Querying quotes for ${uniqueSymbols.length} stocks in batch chunks...`);

        const chunks = chunkArray(uniqueSymbols, 150);
        const liveBasicQuotes: any[] = [];

        await Promise.all(chunks.map(async (chunk) => {
            try {
                const batchResult = await yahooFinance.quote(chunk, undefined, { validateResult: false });
                const quotes = Array.isArray(batchResult) ? batchResult : [batchResult];
                liveBasicQuotes.push(...quotes.filter(Boolean));
            } catch (err) {
                // Ignore chunk failures
            }
        }));

        const candidates = liveBasicQuotes.filter(q => {
            const price = q.regularMarketPrice || 0;
            const volume = q.regularMarketVolume || 0;
            const avgVolume = q.averageDailyVolume3Month || 100000;
            const marketCap = q.marketCap || 0;

            const isLiquid = volume >= 50000 || avgVolume >= 50000;
            const isTradeable = price >= 10 && price <= 25000;
            const isSizable = marketCap >= 30000000000; // 3000 Cr
            
            return isLiquid && isTradeable && isSizable;
        });

        console.log(`[QuantScanner] Pre-screened down to ${candidates.length} candidates. Evaluating confluence...`);

        const recommendations: StrategyRecommendation[] = [];

        await parallelPool(candidates, 35, async (q) => {
            try {
                const symbol = q.symbol;
                const price = q.regularMarketPrice || 0;
                const changePercent = q.regularMarketChangePercent || 0;
                const volume = q.regularMarketVolume || 0;
                const avgVolume = q.averageDailyVolume3Month || 1;
                
                // 1. RVOL calculation
                const rvol = volume / avgVolume;
                
                // 2. Gap direction
                const gapPercent = Math.abs(changePercent);

                // 3. Confluence Score estimation (scale to 0-100)
                let score = 50; // Base score
                if (rvol >= 1.5) score += 15;
                if (rvol >= 2.0) score += 10;
                if (gapPercent >= 1.0) score += 10;
                if (gapPercent >= 2.0) score += 10;
                
                // Technical alignment proxy
                if (changePercent > 0.5) {
                    score += 5; // Positive momentum
                } else if (changePercent < -0.5) {
                    score += 5; // Short momentum
                }

                // Bound score to max 100
                const finalScore = Math.min(100, score);

                if (finalScore >= 60) {
                    recommendations.push({
                        id: uuidv4(),
                        strategyId: strategy.id,
                        symbol: symbol,
                        score: finalScore,
                        matchDetails: {
                            rvol,
                            changePercent,
                            gapPercent,
                            price
                        },
                        timestamp: new Date()
                    });
                }
            } catch (e) {
                // Ignore single errors
            }
        });

        const topRecs = recommendations.sort((a, b) => b.score - a.score).slice(0, 10);
        await this.infra.strategy.saveRecommendations(strategy.id, topRecs);

        // Notify
        const notificationService = new NotificationService(this.infra.notification);
        const SYSTEM_USER_ID = "SYSTEM";

        for (const rec of topRecs) {
            if (rec.score >= 80) {
                await notificationService.notifySignal(SYSTEM_USER_ID, {
                    symbol: rec.symbol,
                    type: "PRICE_SURGE",
                    strength: "HIGH",
                    description: `Intraday Confluence breakout setup detected for ${rec.symbol}. Score: ${rec.score}/100.`,
                    timestamp: new Date()
                });
            }
        }

        return topRecs;
    }
}

export class SwingScanner {
    constructor(private infra: Infrastructure) { }

    async scan(): Promise<StrategyRecommendation[]> {
        const strategy = await this.infra.strategy.findBySlug('swing-strategy');
        if (!strategy) return [];

        console.log("[QuantScanner] Starting SWING CONFLUENCE batch scan...");

        let discoveryPool: string[] = [];
        try {
            const fs = await import("fs");
            const path = await import("path");
            const symbolsPath = path.join(process.cwd(), 'src/data/indian-symbols.json');
            const allSymbols = JSON.parse(fs.readFileSync(symbolsPath, 'utf8'));
            discoveryPool = allSymbols;
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
        ])).filter(sym => sym.endsWith('.NS'));

        console.log(`[QuantScanner] Querying quotes for ${uniqueSymbols.length} stocks in batch chunks...`);

        const chunks = chunkArray(uniqueSymbols, 150);
        const liveBasicQuotes: any[] = [];

        await Promise.all(chunks.map(async (chunk) => {
            try {
                const batchResult = await yahooFinance.quote(chunk, undefined, { validateResult: false });
                const quotes = Array.isArray(batchResult) ? batchResult : [batchResult];
                liveBasicQuotes.push(...quotes.filter(Boolean));
            } catch (err) {
                // Ignore chunk failures
            }
        }));

        const candidates = liveBasicQuotes.filter(q => {
            const price = q.regularMarketPrice || 0;
            const volume = q.regularMarketVolume || 0;
            const avgVolume = q.averageDailyVolume3Month || 100000;
            const marketCap = q.marketCap || 0;

            const isLiquid = volume >= 50000 || avgVolume >= 50000;
            const isTradeable = price >= 10 && price <= 25000;
            const isSizable = marketCap >= 30000000000; // 3000 Cr
            
            return isLiquid && isTradeable && isSizable;
        });

        console.log(`[QuantScanner] Pre-screened down to ${candidates.length} candidates. Evaluating swing confluence...`);

        const recommendations: StrategyRecommendation[] = [];

        await parallelPool(candidates, 35, async (q) => {
            try {
                const symbol = q.symbol;
                const price = q.regularMarketPrice || 0;
                const changePercent = q.regularMarketChangePercent || 0;
                const volume = q.regularMarketVolume || 0;
                const avgVolume = q.averageDailyVolume3Month || 1;
                
                const fiftyTwoWeekHigh = q.fiftyTwoWeekHigh || price || 1;
                const distanceToHigh = (fiftyTwoWeekHigh - price) / fiftyTwoWeekHigh;

                // 1. Stage 2 Proxy
                const isAbove52WLow = price > (q.fiftyTwoWeekLow || 0) * 1.3;
                
                // 2. Weekly volume surge proxy
                const volSurge = volume / avgVolume;

                // 3. Confluence Score estimation (scale to 0-100)
                let score = 55; // Base score
                if (isAbove52WLow) score += 15;
                if (distanceToHigh <= 0.05) score += 15; // Near 52W high
                if (volSurge >= 1.5) score += 10;
                if (changePercent > 1.0) score += 5;

                const finalScore = Math.min(100, score);

                if (finalScore >= 65) {
                    recommendations.push({
                        id: uuidv4(),
                        strategyId: strategy.id,
                        symbol: symbol,
                        score: finalScore,
                        matchDetails: {
                            volSurge,
                            changePercent,
                            distanceToHighPercent: distanceToHigh * 100,
                            price
                        },
                        timestamp: new Date()
                    });
                }
            } catch (e) {
                // Ignore single errors
            }
        });

        const topRecs = recommendations.sort((a, b) => b.score - a.score).slice(0, 10);
        await this.infra.strategy.saveRecommendations(strategy.id, topRecs);

        // Notify
        const notificationService = new NotificationService(this.infra.notification);
        const SYSTEM_USER_ID = "SYSTEM";

        for (const rec of topRecs) {
            if (rec.score >= 80) {
                await notificationService.notifySignal(SYSTEM_USER_ID, {
                    symbol: rec.symbol,
                    type: "VOLUME_BREAKOUT",
                    strength: "HIGH",
                    description: `Swing Positional Breakout setup detected for ${rec.symbol}. Score: ${rec.score}/100.`,
                    timestamp: new Date()
                });
            }
        }

        return topRecs;
    }
}


