import { Infrastructure } from "../infrastructure/container";
import { StrategyRecommendation } from "../domain/strategy";
import { v4 as uuidv4 } from "uuid";
import { NotificationService } from "../application/notification-service";
import { MetricsRegistry } from "../infrastructure/metrics";
import { Logger } from "../infrastructure/logger";
import YahooFinance from 'yahoo-finance2';

// ─────────────────────────────────────────────────────────────────────────────
// Shared utilities
// ─────────────────────────────────────────────────────────────────────────────

function chunkArray<T>(array: T[], size: number): T[][] {
    const chunked: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunked.push(array.slice(i, i + size));
    }
    return chunked;
}

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

// ─────────────────────────────────────────────────────────────────────────────
// Pre-screen filter options
// ─────────────────────────────────────────────────────────────────────────────

interface PreScreenOptions {
    minMarketCap?: number;   // default: 30_000_000_000 (3000 Cr)
    minVolume?: number;      // default: 10_000
    minPrice?: number;       // default: 5
    maxPrice?: number;       // optional upper price limit
    maxChangePercent?: number; // default: no upper limit
    minChangePercent?: number; // default: -5
    minVolumeOrAvg?: boolean;  // use volume OR avgVolume (for intraday/swing)
}

// ─────────────────────────────────────────────────────────────────────────────
// Notification signal type
// ─────────────────────────────────────────────────────────────────────────────

type SignalType = 'PRICE_SURGE' | 'INSTITUTIONAL_BUY' | 'VOLUME_BREAKOUT';

interface NotifyOptions {
    minScore: number;
    type: SignalType;
    description: (rec: StrategyRecommendation) => string;
}

// ─────────────────────────────────────────────────────────────────────────────
// BaseScanner — all shared boilerplate lives here
// ─────────────────────────────────────────────────────────────────────────────

export abstract class BaseScanner {
    protected readonly yahooFinance: InstanceType<typeof YahooFinance>;
    private readonly SYSTEM_USER_ID = 'SYSTEM';
    private readonly DEFAULT_MIN_MARKET_CAP = 30_000_000_000; // 3000 Cr

    constructor(protected infra: Infrastructure) {
        this.yahooFinance = new YahooFinance();
    }

    // ── 1. Load symbol pool ─────────────────────────────────────────────────

    protected async loadSymbolPool(): Promise<string[]> {
        try {
            const fs = await import('fs');
            const path = await import('path');
            const symbolsPath = path.join(process.cwd(), 'src/data/indian-symbols.json');
            return JSON.parse(fs.readFileSync(symbolsPath, 'utf8')) as string[];
        } catch (err) {
            console.error('[QuantScanner] Failed to load discovery pool:', err);
            return [];
        }
    }

    // ── 2. Fetch screener symbols via infra.market (uses HybridMarketAdapter) ──

    protected async fetchScreenerSymbols(screeners: string[], limit = 50): Promise<string[]> {
        const pools = await Promise.all(
            screeners.map(s => this.infra.market.getScreenerData(s, limit).catch(() => []))
        );
        return pools.flat().map(s => s.symbol).filter((sym): sym is string => Boolean(sym));
    }

    // ── 3. Build unique NSE symbol set ──────────────────────────────────────

    protected buildSymbolSet(discoveryPool: string[], screenerSymbols: string[]): string[] {
        return Array.from(new Set([...discoveryPool, ...screenerSymbols]))
            .filter(sym => sym.endsWith('.NS'));
    }

    // ── 4. Batch-fetch basic quotes (chunked, tolerates partial failures) ───

    protected async fetchBatchQuotes(symbols: string[]): Promise<any[]> {
        const chunks = chunkArray(symbols, 150);
        const allQuotes: any[] = [];

        await Promise.all(chunks.map(async (chunk) => {
            try {
                const result = await this.yahooFinance.quote(chunk, undefined, { validateResult: false });
                const quotes = Array.isArray(result) ? result : [result];
                allQuotes.push(...quotes.filter(Boolean));
            } catch {
                // Ignore chunk-level failures — partial data is fine
            }
        }));

        return allQuotes;
    }

    // ── 5. Pre-screen quotes ────────────────────────────────────────────────

    protected preScreen(quotes: any[], opts: PreScreenOptions = {}): any[] {
        const {
            minMarketCap = this.DEFAULT_MIN_MARKET_CAP,
            minVolume = 10_000,
            minPrice = 5,
            maxPrice,
            minChangePercent = -5,
            minVolumeOrAvg = false,
        } = opts;

        return quotes.filter(q => {
            const price = q.regularMarketPrice || 0;
            const marketCap = q.marketCap || 0;
            const volume = q.regularMarketVolume || 0;
            const avgVolume = q.averageDailyVolume3Month || 0;
            const changePercent = q.regularMarketChangePercent || 0;

            const liquidityPass = minVolumeOrAvg
                ? (volume >= minVolume || avgVolume >= minVolume)
                : volume >= minVolume;

            return (
                liquidityPass &&
                price >= minPrice &&
                (!maxPrice || price <= maxPrice) &&
                marketCap >= minMarketCap &&
                changePercent >= minChangePercent
            );
        });
    }

    // ── 6. Deep eval via parallelPool ───────────────────────────────────────

    protected async deepEval(
        candidates: any[],
        concurrency: number,
        scorer: (quote: any) => Promise<StrategyRecommendation | null>
    ): Promise<StrategyRecommendation[]> {
        const recommendations: StrategyRecommendation[] = [];

        await parallelPool(candidates, concurrency, async (q) => {
            try {
                const rec = await scorer(q);
                if (rec) recommendations.push(rec);
            } catch {
                // Ignore individual stock errors
            }
        });

        return recommendations;
    }

    // ── 7. Save top N recommendations and optionally notify ─────────────────

    protected async saveAndNotify(
        strategyId: string,
        recommendations: StrategyRecommendation[],
        topN: number,
        notify: NotifyOptions
    ): Promise<StrategyRecommendation[]> {
        const topRecs = recommendations.sort((a, b) => b.score - a.score).slice(0, topN);

        // Clear old recommendations for this strategy to avoid stale data accumulation
        await this.infra.strategy.clearRecommendations(strategyId);

        await this.infra.strategy.saveRecommendations(strategyId, topRecs);

        const notificationService = new NotificationService(this.infra.notification);

        for (const rec of topRecs) {
            if (rec.score >= notify.minScore) {
                await notificationService.notifySignal(this.SYSTEM_USER_ID, {
                    symbol: rec.symbol,
                    type: notify.type,
                    strength: 'HIGH',
                    description: notify.description(rec),
                    timestamp: new Date(),
                });
            }
        }

        return topRecs;
    }

    // ── 8. Orchestrate the full scan pipeline ───────────────────────────────

    protected async runScan(config: {
        strategySlug: string;
        screeners: string[];
        preScreenOpts?: PreScreenOptions;
        concurrency?: number;
        topN?: number;
        scorer: (quote: any, strategyId: string) => Promise<StrategyRecommendation | null>;
        notify: NotifyOptions;
        label: string;
    }): Promise<StrategyRecommendation[]> {
        const strategy = await this.infra.strategy.findBySlug(config.strategySlug);
        if (!strategy) return [];

        const scanStart = Date.now();
        Logger.started('Scanner', config.strategySlug, { label: config.label });

        const [discoveryPool, screenerSymbols] = await Promise.all([
            this.loadSymbolPool(),
            this.fetchScreenerSymbols(config.screeners),
        ]);

        const symbols = this.buildSymbolSet(discoveryPool, screenerSymbols);
        const allQuotes = await this.fetchBatchQuotes(symbols);
        const candidates = this.preScreen(allQuotes, config.preScreenOpts);

        let evaluatedCount = 0;
        const recommendations = await this.deepEval(
            candidates,
            config.concurrency ?? 35,
            async (q) => {
                const rec = await config.scorer(q, strategy.id);
                if (rec) evaluatedCount++;
                return rec;
            }
        );

        const topRecs = await this.saveAndNotify(
            strategy.id,
            recommendations,
            config.topN ?? 10,
            config.notify
        );

        const durationMs = Date.now() - scanStart;
        MetricsRegistry.recordScan(
            config.strategySlug,
            symbols.length,
            candidates.length,
            topRecs.length,
            durationMs
        );
        Logger.info('Scanner', config.strategySlug, {
            symbolsScanned: symbols.length,
            symbolsFiltered: candidates.length,
            recommendations: topRecs.length,
        }, durationMs);

        return topRecs;
    }

    abstract scan(): Promise<StrategyRecommendation[]>;
}

// ─────────────────────────────────────────────────────────────────────────────
// CANSLIM Scanner
// ─────────────────────────────────────────────────────────────────────────────

export class CanslimScanner extends BaseScanner {
    async scan(): Promise<StrategyRecommendation[]> {
        return this.runScan({
            strategySlug: 'canslim',
            screeners: ['most_actives', 'day_gainers', 'day_losers'],
            preScreenOpts: {
                minVolume: 10_000,
                minPrice: 5,
                minMarketCap: 30_000_000_000,
                minChangePercent: -5,
            },
            concurrency: 35,
            topN: 20,
            label: 'CANSLIM',
            scorer: async (q, strategyId) => {
                const summaryRes = await this.yahooFinance.quoteSummary(q.symbol, {
                    modules: ['defaultKeyStatistics', 'financialData', 'summaryDetail']
                }, { validateResult: false }).catch(() => null);

                if (!summaryRes) return null;

                const financialData = (summaryRes as any).financialData || {};
                const keyStats = (summaryRes as any).defaultKeyStatistics || {};

                const roe = (financialData.returnOnEquity || 0) * 100;
                const earningsGrowth = (financialData.earningsGrowth || 0) * 100;
                const revenueGrowth = (financialData.revenueGrowth || 0) * 100;

                const c_pass = earningsGrowth >= 15 || revenueGrowth >= 10;
                const a_pass = roe >= 10;

                const fiftyTwoWeekHigh = q.fiftyTwoWeekHigh || q.regularMarketPrice || 0;
                const distanceToHigh = q.regularMarketPrice && fiftyTwoWeekHigh
                    ? q.regularMarketPrice / fiftyTwoWeekHigh : 0;
                const n_pass = distanceToHigh >= 0.75;

                const s_pass = (q.marketCap || 0) >= 30_000_000_000;
                const l_pass = (q.regularMarketChangePercent || 0) > -5;
                const i_pass = (keyStats.heldPercentInstitutions || 0) >= 0;

                let score = 0;
                if (c_pass) score += 25;
                if (a_pass) score += 20;
                if (n_pass) score += 20;
                if (s_pass) score += 15;
                if (l_pass) score += 10;
                if (i_pass) score += 10;

                if (score < 30) return null;

                // Tie-breaker: prefer higher ROE, higher combined growth, and closer proximity to 52W high
                const roeFactor = Math.min(10, roe) / 10;
                const growthFactor = Math.min(100, Math.max(0, earningsGrowth + revenueGrowth)) / 100;
                const highFactor = Math.min(1, distanceToHigh);
                const tieBreaker = (roeFactor * 0.4) + (growthFactor * 0.4) + (highFactor * 0.2);
                const finalScore = score + Number(tieBreaker.toFixed(4));

                return {
                    id: uuidv4(),
                    strategyId,
                    symbol: q.symbol,
                    score: finalScore,
                    matchDetails: {
                        earningsGrowth,
                        revenueGrowth,
                        roe,
                        distanceToHigh,
                        institutionOwnership: keyStats.heldPercentInstitutions,
                    },
                    timestamp: new Date(),
                };
            },
            notify: {
                minScore: 70,
                type: 'PRICE_SURGE',
                description: (rec) =>
                    `New high-conviction CANSLIM match discovered for ${rec.symbol} with a score of ${rec.score}/100.`,
            },
        });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Intermarket Scanner
// ─────────────────────────────────────────────────────────────────────────────

export class IntermarketScanner extends BaseScanner {
    async scan(): Promise<StrategyRecommendation[]> {
        return this.runScan({
            strategySlug: 'intermarket-analysis-india',
            screeners: ['most_actives', 'day_gainers'],
            preScreenOpts: {
                minVolume: 20_000,
                minPrice: 5,
                minMarketCap: 30_000_000_000,
                minChangePercent: -2,
            },
            concurrency: 35,
            topN: 20,
            label: 'INTERMARKET',
            scorer: async (q, strategyId) => {
                const summaryRes = await this.yahooFinance.quoteSummary(q.symbol, {
                    modules: ['defaultKeyStatistics', 'financialData', 'summaryDetail']
                }, { validateResult: false }).catch(() => null);

                if (!summaryRes) return null;

                const financialData = (summaryRes as any).financialData || {};

                const debtToEquity = financialData.debtToEquity || 0;
                if (debtToEquity >= 200) return null;

                const fiftyTwoWeekHigh = q.fiftyTwoWeekHigh || q.regularMarketPrice || 0;
                const fiftyTwoWeekLow = q.fiftyTwoWeekLow || q.regularMarketPrice || 0;

                const distanceToHigh = q.regularMarketPrice / fiftyTwoWeekHigh;
                const breakoutPass = distanceToHigh >= 0.70;

                const approxMa200 = (fiftyTwoWeekHigh + fiftyTwoWeekLow) / 2;
                const trendPass = q.regularMarketPrice > approxMa200;
                const momentumPass = (q.regularMarketChangePercent || 0) > -2;

                let score = 0;
                if (breakoutPass) score += 40;
                if (trendPass) score += 30;
                if (momentumPass) score += 20;
                if (debtToEquity < 100) score += 10;

                if (score < 40) return null;

                // Tie-breaker: prefer lower debt-to-equity, closer proximity to 52W high, and positive momentum
                const debtFactor = debtToEquity <= 0 ? 1 : Math.max(0, 100 - debtToEquity) / 100;
                const highFactor = Math.min(1, distanceToHigh);
                const momentumFactor = Math.min(10, Math.max(0, q.regularMarketChangePercent || 0)) / 10;
                const tieBreaker = (debtFactor * 0.3) + (highFactor * 0.4) + (momentumFactor * 0.3);
                const finalScore = score + Number(tieBreaker.toFixed(4));

                return {
                    id: uuidv4(),
                    strategyId,
                    symbol: q.symbol,
                    score: finalScore,
                    matchDetails: {
                        debtToEquity,
                        distanceToHigh,
                        price: q.regularMarketPrice,
                        approxMa200,
                    },
                    timestamp: new Date(),
                };
            },
            notify: {
                minScore: 80,
                type: 'INSTITUTIONAL_BUY',
                description: (rec) =>
                    `Strategic breakout detected for ${rec.symbol}. Momentum score: ${rec.score}/100.`,
            },
        });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Buffett (IVCF) Scanner
// ─────────────────────────────────────────────────────────────────────────────

export class BuffetScanner extends BaseScanner {
    async scan(): Promise<StrategyRecommendation[]> {
        return this.runScan({
            strategySlug: 'warren-buffet',
            screeners: ['most_actives', 'undervalued_growth_stocks'],
            preScreenOpts: {
                minVolume: 10_000,
                minPrice: 5,
                minMarketCap: 30_000_000_000,
            },
            concurrency: 35,
            topN: 20,
            label: 'WARREN BUFFET (IVCF)',
            scorer: async (q, strategyId) => {
                // Additional pre-screen: reasonable PE
                const pe = q.trailingPE || 25;
                if (pe >= 50) return null;

                const summaryRes = await this.yahooFinance.quoteSummary(q.symbol, {
                    modules: ['defaultKeyStatistics', 'financialData', 'summaryDetail']
                }, { validateResult: false }).catch(() => null);

                if (!summaryRes) return null;

                const financialData = (summaryRes as any).financialData || {};

                const roe = (financialData.returnOnEquity || 0) * 100;
                const opm = (financialData.operatingMargins || 0) * 100;
                const roa = (financialData.returnOnAssets || 0) * 100;

                const isBank = q.sector?.toLowerCase().includes('bank') || q.sector?.toLowerCase().includes('finance');
                const q_val = isBank ? (roe + roa * 5) / 2 : (roe + (roe * 1.1) + opm) / 3;
                const q_score = Math.min(100, (q_val / 15) * 100);

                const m_score = Math.min(100, ((q.marketCap || 0) / 1_000_000_000) * 10 + (opm > 20 ? 40 : 20));

                const de = financialData.debtToEquity || 0;
                const f_score = Math.max(0, 100 - de);

                const v_score = pe < 15 ? 100 : pe < 25 ? 90 : pe < 40 ? 80 : 60;

                const revGrowth = (financialData.revenueGrowth || 0) * 100;
                const epsGrowth = (financialData.earningsGrowth || 0) * 100;
                const g_score = Math.min(100, (revGrowth + epsGrowth) / 2 * 4);

                const totalScore = (0.25 * q_score) +
                    (0.20 * m_score) +
                    (0.20 * f_score) +
                    (0.20 * v_score) +
                    (0.15 * g_score);

                const passesROE = roe > 15;
                const passesDE = de < 50;

                if (totalScore < 65 && !(passesROE && passesDE)) return null;

                // Tie-breaker: favor higher ROE and lower debt-to-equity to avoid ties
                const roeFactor = Math.min(100, roe) / 100;
                const deFactor = de <= 0 ? 1 : Math.max(0, 200 - de) / 200;
                const tieBreaker = (roeFactor * 0.5) + (deFactor * 0.5);
                const finalScore = Number((totalScore + tieBreaker).toFixed(4));

                return {
                    id: uuidv4(),
                    strategyId,
                    symbol: q.symbol,
                    score: finalScore,
                    matchDetails: { q_score, m_score, f_score, v_score, g_score, roe, de, pe },
                    timestamp: new Date(),
                };
            },
            notify: {
                minScore: 80,
                type: 'INSTITUTIONAL_BUY',
                description: (rec) =>
                    `New Indian Buffett Compounder detected: ${rec.symbol}. IVCF Score: ${rec.score}/100.`,
            },
        });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Intraday Confluence Scanner
// ─────────────────────────────────────────────────────────────────────────────

export class IntradayScanner extends BaseScanner {
    async scan(): Promise<StrategyRecommendation[]> {
        return this.runScan({
            strategySlug: 'intraday-strategy',
            screeners: ['most_actives', 'day_gainers'],
            preScreenOpts: {
                minVolume: 50_000,
                minPrice: 10,
                maxPrice: 25_000,
                minMarketCap: 30_000_000_000,
                minChangePercent: -100, // no change filter for intraday
                minVolumeOrAvg: true,
            },
            concurrency: 35,
            topN: 20,
            label: 'INTRADAY CONFLUENCE',
            scorer: async (q, strategyId) => {
                const price = q.regularMarketPrice || 0;
                const changePercent = q.regularMarketChangePercent || 0;
                const volume = q.regularMarketVolume || 0;
                const avgVolume = q.averageDailyVolume3Month || 1;

                const rvol = volume / avgVolume;
                const gapPercent = Math.abs(changePercent);

                let score = 50;
                if (rvol >= 1.5) score += 15;
                if (rvol >= 2.0) score += 10;
                if (gapPercent >= 1.0) score += 10;
                if (gapPercent >= 2.0) score += 10;
                if (changePercent > 0.5 || changePercent < -0.5) score += 5;

                if (score < 60) return null;

                // Tie-breaker: prefer higher relative volume and larger absolute price change gap
                const rvolFactor = Math.min(5, rvol) / 5;
                const gapFactor = Math.min(10, gapPercent) / 10;
                const tieBreaker = (rvolFactor * 0.6) + (gapFactor * 0.4);
                const finalScore = score + Number(tieBreaker.toFixed(4));

                return {
                    id: uuidv4(),
                    strategyId,
                    symbol: q.symbol,
                    score: finalScore,
                    matchDetails: { rvol, changePercent, gapPercent, price },
                    timestamp: new Date(),
                };
            },
            notify: {
                minScore: 80,
                type: 'PRICE_SURGE',
                description: (rec) =>
                    `Intraday Confluence breakout setup detected for ${rec.symbol}. Score: ${rec.score}/100.`,
            },
        });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Swing Confluence Scanner
// ─────────────────────────────────────────────────────────────────────────────

export class SwingScanner extends BaseScanner {
    async scan(): Promise<StrategyRecommendation[]> {
        return this.runScan({
            strategySlug: 'swing-strategy',
            screeners: ['most_actives', 'day_gainers'],
            preScreenOpts: {
                minVolume: 50_000,
                minPrice: 10,
                maxPrice: 25_000,
                minMarketCap: 30_000_000_000,
                minChangePercent: -100,
                minVolumeOrAvg: true,
            },
            concurrency: 35,
            topN: 20,
            label: 'SWING CONFLUENCE',
            scorer: async (q, strategyId) => {
                const price = q.regularMarketPrice || 0;
                const changePercent = q.regularMarketChangePercent || 0;
                const volume = q.regularMarketVolume || 0;
                const avgVolume = q.averageDailyVolume3Month || 1;

                const fiftyTwoWeekHigh = q.fiftyTwoWeekHigh || price || 1;
                const distanceToHigh = (fiftyTwoWeekHigh - price) / fiftyTwoWeekHigh;

                const isAbove52WLow = price > (q.fiftyTwoWeekLow || 0) * 1.3;
                const volSurge = volume / avgVolume;

                let score = 55;
                if (isAbove52WLow) score += 15;
                if (distanceToHigh <= 0.05) score += 15; // Near 52W high
                if (volSurge >= 1.5) score += 10;
                if (changePercent > 1.0) score += 5;

                if (score < 65) return null;

                // Tie-breaker: prefer higher volume surge, closer proximity to 52W high, and higher positive price change
                const volFactor = Math.min(5, volSurge) / 5;
                const highFactor = Math.max(0, 1 - distanceToHigh);
                const changeFactor = Math.min(10, Math.max(0, changePercent)) / 10;
                const tieBreaker = (volFactor * 0.4) + (highFactor * 0.4) + (changeFactor * 0.2);
                const finalScore = score + Number(tieBreaker.toFixed(4));

                return {
                    id: uuidv4(),
                    strategyId,
                    symbol: q.symbol,
                    score: finalScore,
                    matchDetails: {
                        volSurge,
                        changePercent,
                        distanceToHighPercent: distanceToHigh * 100,
                        price,
                    },
                    timestamp: new Date(),
                };
            },
            notify: {
                minScore: 80,
                type: 'VOLUME_BREAKOUT',
                description: (rec) =>
                    `Swing Positional Breakout setup detected for ${rec.symbol}. Score: ${rec.score}/100.`,
            },
        });
    }
}
