import * as fs from 'fs';
import * as path from 'path';
import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();

import { MarketDataPort } from "../../ports/market-data-port";
import { Stock } from "../../domain/stock";
import { CacheUtils } from '../../infrastructure/cache-utils';

export class YahooFinanceMarketAdapter implements MarketDataPort {
    private async withRetry<T>(fn: () => Promise<T>, symbol: string, retries = 3, delay = 2000): Promise<T | null> {
        try {
            return await fn();
        } catch (error: any) {
            const isConnectionError =
                error.code === 'ECONNRESET' ||
                error.cause?.code === 'ECONNRESET' ||
                error.message?.includes('fetch failed') ||
                error.message?.includes('ECONNRESET');

            if (retries > 0 && isConnectionError) {
                console.warn(`[StockIntel] Attempting retry for ${symbol} due to connection error... (${retries} left)`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.withRetry(fn, symbol, retries - 1, delay * 2);
            }
            throw error;
        }
    }

    async getStockPrice(symbol: string): Promise<Partial<Stock>> {
        const cacheKey = `price_${symbol}`;
        try {
            // Use quoteSummary to get deep fundamental data
            const [quoteRes, summaryRes] = await Promise.all([
                this.withRetry(() => yahooFinance.quote(symbol, undefined, { validateResult: false }), symbol),
                this.withRetry(() => yahooFinance.quoteSummary(symbol, {
                    modules: ['defaultKeyStatistics', 'financialData', 'summaryDetail']
                }, { validateResult: false }), symbol)
            ]);

            if (!quoteRes || (Array.isArray(quoteRes) && quoteRes.length === 0)) {
                const fallback = CacheUtils.getFallback(cacheKey);
                if (fallback) return fallback;
                throw new Error(`Yahoo Finance returned no data for ${symbol}`);
            }

            const data = Array.isArray(quoteRes) ? quoteRes[0] : (quoteRes as any);
            const summary = summaryRes as any || {};
            const financialData = summary.financialData || {};
            const keyStats = summary.defaultKeyStatistics || {};
            const summaryDetail = summary.summaryDetail || {};

            // AGGRESSIVE NAME DISCOVERY
            // Compare all available name fields and pick the longest one to avoid truncation
            const nameCandidates = [
                data.longName,
                data.shortName,
                data.displayName,
                summaryDetail.longName,
                summaryDetail.shortName
            ].filter(Boolean);

            const institutionalName = nameCandidates.length > 0
                ? nameCandidates.reduce((a, b) => a.length > b.length ? a : b)
                : symbol;

            const stock: Partial<Stock> = {
                symbol,
                name: institutionalName,
                price: data.regularMarketPrice || data.bid || data.ask || 0,
                change: data.regularMarketChange || 0,
                changePercent: data.regularMarketChangePercent || 0,
                marketCap: data.marketCap || summaryDetail.marketCap || 0,
                volume: data.regularMarketVolume || data.averageDailyVolume3Month || 0,
                peRatio: data.trailingPE || summaryDetail.trailingPE || data.forwardPE || 0,
                dividendYield: data.trailingAnnualDividendYield || summaryDetail.dividendYield || (data.dividendYield ? data.dividendYield / 100 : 0),
                dayHigh: data.regularMarketDayHigh || summaryDetail.dayHigh || data.regularMarketPrice || data.bid || 0,
                dayLow: data.regularMarketDayLow || summaryDetail.dayLow || data.regularMarketPrice || data.bid || 0,
                fiftyTwoWeekHigh: data.fiftyTwoWeekHigh || summaryDetail.fiftyTwoWeekHigh || data.regularMarketPrice || 0,
                fiftyTwoWeekLow: data.fiftyTwoWeekLow || summaryDetail.fiftyTwoWeekLow || data.regularMarketPrice || 0,
                currency: data.currency || (symbol.endsWith('.NS') || symbol.endsWith('.BO') ? 'INR' : 'USD'),
                sector: data.sector || data.industry || null,

                // New Fundamentals
                eps: data.epsTrailingTwelveMonths || keyStats.trailingEps || 0,
                epsForward: keyStats.forwardEps || 0,
                beta: keyStats.beta || 0,
                pbRatio: keyStats.priceToBook || 0,
                forwardPe: keyStats.forwardPE || 0,
                revenue: financialData.totalRevenue || 0,
                ebitda: financialData.ebitda || 0,
                roe: financialData.returnOnEquity || 0,
                roa: financialData.returnOnAssets || 0,
                profitMargins: financialData.profitMargins || 0,
                grossMargins: financialData.grossMargins || 0,
                operatingMargins: financialData.operatingMargins || 0,
                ebitdaMargins: financialData.ebitdaMargins || 0,
                revenueGrowth: financialData.revenueGrowth || 0,
                earningsGrowth: financialData.earningsGrowth || 0,
                sharesOutstanding: keyStats.sharesOutstanding || 0,
                floatShares: keyStats.floatShares || 0,
                insiderOwnership: keyStats.heldPercentInsiders || 0,
                institutionOwnership: keyStats.heldPercentInstitutions || 0,
                totalCash: financialData.totalCash || 0,
                totalDebt: financialData.totalDebt || 0,
                debtToEquity: financialData.debtToEquity || 0,
                quickRatio: financialData.quickRatio || 0,
                currentRatio: financialData.currentRatio || 0,
                freeCashflow: financialData.freeCashflow || 0,
                operatingCashflow: financialData.operatingCashflow || 0,
                enterpriseValue: keyStats.enterpriseValue || 0,
                enterpriseToRevenue: keyStats.enterpriseToRevenue || 0,
                enterpriseToEbitda: keyStats.enterpriseToEbitda || 0,
                bookValue: keyStats.bookValue || 0,
                priceToSales: keyStats.enterpriseToRevenue || 0,
                fiftyTwoWeekChange: keyStats['52WeekChange'] || 0,
                lastDividendValue: keyStats.lastDividendValue || 0,
                lastDividendDate: keyStats.lastDividendDate ? new Date(keyStats.lastDividendDate) : undefined,

                lastUpdated: new Date()
            };

            CacheUtils.set(cacheKey, stock);
            return stock;
        } catch (error) {
            console.error(`Error fetching price for ${symbol}:`, error);

            const fallback = CacheUtils.getFallback(cacheKey);
            if (fallback) {
                console.info(`Serving fallback data for ${symbol}`);
                return fallback;
            }

            return {
                symbol,
                name: symbol,
                price: 0,
                change: 0,
                changePercent: 0,
                lastUpdated: new Date()
            };
        }
    }

    async getHistoricalData(symbol: string, period: string = '1mo', fromDate?: Date): Promise<any[]> {
        const cacheKey = `history_${symbol}_${period}`;
        try {
            if (!symbol || symbol === 'undefined') return [];

            const to = new Date();
            const from = new Date();

            const daysMap: Record<string, number> = {
                '1d': 1,
                '1mo': 30,
                '3mo': 90,
                '6mo': 180,
                '1y': 365,
                '5y': 1825,
                'ytd': 0,
                'all': 0
            };

            let interval: "2m" | "1d" | "1wk" | "1mo" = '1d';

            if (fromDate) {
                from.setTime(fromDate.getTime());
                interval = '1d';
            } else if (period === 'ytd') {
                // User explicitly requested YTD to mean rolling year (last 12 months)
                from.setFullYear(to.getFullYear() - 1);
            } else if (period === 'all') {
                // Capture maximum history back to 1980
                from.setFullYear(1980, 0, 1);
                interval = '1mo'; // Monthly for performance on massive ranges
            } else if (period === '1d') {
                from.setHours(0, 0, 0, 0);
                interval = '2m'; // Intraday high fidelity
            } else if (period === '5y') {
                from.setFullYear(to.getFullYear() - 5);
                interval = '1wk';
            } else {
                const days = daysMap[period] || 30;
                from.setDate(from.getDate() - days);
            }

            const result = await this.withRetry(() => yahooFinance.chart(symbol, {
                period1: from,
                period2: to,
                interval: interval
            }), symbol);

            if (!result || !result.quotes) {
                const fallback = CacheUtils.getFallback(cacheKey);
                return fallback || [];
            }

            const formatted = result.quotes
                .filter((q: any) => q.close !== undefined && q.close !== null)
                .map((item: any) => ({
                    date: item.date,
                    close: item.close
                }));

            CacheUtils.set(cacheKey, formatted);
            return formatted;
        } catch (error) {
            console.error(`Error fetching historical data for ${symbol}:`, error);
            const fallback = CacheUtils.getFallback(cacheKey);
            return fallback || [];
        }
    }

    async getPerformance(symbol: string, period: string = '1mo'): Promise<{
        change: number;
        changePercent: number;
        currentPrice: number;
        volume?: number;
        symbol: string;
        low?: number;
        high?: number;
        sector?: string | null;
    }> {
        const stock = await this.getStockPrice(symbol);

        if (period === '1d' || !period) {
            return {
                symbol,
                change: stock.change || 0,
                changePercent: stock.changePercent || 0,
                currentPrice: stock.price || 0,
                volume: stock.volume,
                low: stock.dayLow || stock.price,
                high: stock.dayHigh || stock.price,
                sector: stock.sector
            };
        }

        const cacheKey = `perf_${symbol}_${period}`;
        try {
            const end = new Date();
            const start = new Date();

            if (period === '1mo') start.setMonth(start.getMonth() - 1);
            else if (period === '3mo') start.setMonth(start.getMonth() - 3);
            else if (period === '6mo') start.setMonth(start.getMonth() - 6);
            else if (period === '1y') start.setFullYear(start.getFullYear() - 1);
            else if (period === '5y') start.setFullYear(start.getFullYear() - 5);
            else if (period === 'ytd') start.setFullYear(start.getFullYear() - 1); // Rolling year as per user preference
            else if (period === 'all') start.setFullYear(1980, 0, 1); // Consistent with getHistoricalData
            else start.setMonth(start.getMonth() - 1); // Default 1M

            const result = await this.withRetry(() => yahooFinance.chart(symbol, {
                period1: start,
                period2: end,
                interval: '1d'
            }), symbol);

            if (!result || !result.quotes || result.quotes.length === 0 || !stock.price) {
                return {
                    symbol,
                    change: stock.change || 0,
                    changePercent: stock.changePercent || 0,
                    currentPrice: stock.price || 0,
                    volume: stock.volume
                };
            }

            const history = result.quotes.filter((q: any) => q.close !== undefined && q.close !== null);
            if (history.length === 0) {
                return {
                    symbol,
                    change: stock.change || 0,
                    changePercent: stock.changePercent || 0,
                    currentPrice: stock.price || 0,
                    volume: stock.volume
                };
            }

            const startPrice = history[0].close;
            if (startPrice === null || startPrice === undefined) {
                return {
                    symbol,
                    change: stock.change || 0,
                    changePercent: stock.changePercent || 0,
                    currentPrice: stock.price || 0,
                    volume: stock.volume
                };
            }
            const currentPrice = stock.price;
            const change = currentPrice - startPrice;
            const changePercent = (change / startPrice) * 100;

            // Calculate Period Low/High using the actual daily high/low values
            const pricesLow = history.map((h: any) => h.low).filter((p: any) => typeof p === 'number');
            const pricesHigh = history.map((h: any) => h.high).filter((p: any) => typeof p === 'number');

            const low = Math.min(...pricesLow, currentPrice);
            const high = Math.max(...pricesHigh, currentPrice);

            const resultObj = {
                symbol,
                change,
                changePercent,
                currentPrice,
                volume: stock.volume,
                low,
                high,
                sector: stock.sector
            };
            CacheUtils.set(cacheKey, resultObj);
            return resultObj;
        } catch (error) {
            console.error(`Error calculating performance for ${symbol}:`, error);
            const fallback = CacheUtils.getFallback(cacheKey);
            return fallback || { symbol, change: 0, changePercent: 0, currentPrice: 0, volume: stock.volume };
        }
    }

    async searchStocks(query: string): Promise<Partial<Stock>[]> {
        try {
            // Fetch more results to allow for better ranking/filtering in the API layer
            // Increased to 50 to ensure we capture both NSE and BSE versions of highly traded stocks
            const result = await (yahooFinance.search(query, { quotesCount: 50 }) as any);

            if (!result.quotes) return [];

            return result.quotes.map((quote: any) => {
                const nameCandidates = [quote.longname, quote.shortname].filter(Boolean);
                const bestName = nameCandidates.length > 0
                    ? nameCandidates.reduce((a, b) => a.length > b.length ? a : b)
                    : quote.symbol;

                return {
                    symbol: quote.symbol,
                    name: bestName
                };
            });
        } catch (error) {
            console.error(`Error searching stocks for ${query}:`, error);
            return [];
        }
    }

    private getDynamicSymbols(): string[] {
        try {
            const dataPath = path.join(process.cwd(), 'src/data/indian-symbols.json');
            if (fs.existsSync(dataPath)) {
                return JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
            }
        } catch (error) {
            console.error('[StockIntel] Error loading dynamic symbols:', error);
        }
        return [
            'RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'INFY.NS', 'ICICIBANK.NS',
            'TATAMOTORS.NS', 'SBIN.NS', 'BHARTIARTL.NS'
        ]; // Minimal fallback
    }

    async getScreenerData(scrId: string, count: number = 25): Promise<Partial<Stock>[]> {
        const cacheKey = `screener_in_v2_${scrId}_${count}`;
        try {
            // First attempt: Try the predefined screener with region IN
            // (Note: This often returns US results even with region IN)
            const fetchCount = Math.max(count * 4, 100);
            const result = await this.withRetry(() => yahooFinance.screener({
                scrIds: scrId as any,
                count: fetchCount,
                region: 'IN'
            }, undefined, { validateResult: false }), `screener_${scrId}`);

            let quotes: any[] = (result as any)?.quotes || [];

            // If we got zero results OR they are all US stocks (default behavior for standard IDs)
            // we fall back to our curated Indian stock list to provide a better regional experience.
            const isAllUS = quotes.length > 0 && quotes.every((q: any) => q.currency === 'USD');
            if (quotes.length === 0 || isAllUS) {
                console.info(`[StockIntel] Screener ${scrId} for region IN: Using Smart Fallback`);

                const allSymbols = this.getDynamicSymbols();
                // Expanded core seeds to ensure high-liquidity stocks are always present
                const coreSeeds = [
                    'RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'INFY.NS', 'ICICIBANK.NS',
                    'TATAMOTORS.NS', 'SBIN.NS', 'BHARTIARTL.NS', 'ITC.NS', 'LT.NS',
                    'WIPRO.NS', 'ASIANPAINT.NS', 'TITAN.NS', 'ADANIENT.NS', 'MARUTI.NS',
                    'SUNPHARMA.NS', 'HCLTECH.NS', 'KOTAKBANK.NS', 'AXISBANK.NS', 'ONGC.NS',
                    'BAJAJ-AUTO.NS', 'NTPC.NS', 'POWERGRID.NS', 'COALINDIA.NS'
                ];

                // Shuffle and sample 150 random from the 8k pool
                const pool = allSymbols.filter(s => !coreSeeds.includes(s));
                const randomSample = pool.sort(() => 0.5 - Math.random()).slice(0, 150);
                const testBatch = Array.from(new Set([...coreSeeds, ...randomSample])).slice(0, 200);

                // Fetch and filter for valid results only (with validation suppressed via third argument)
                const batchResult = await this.withRetry(() => yahooFinance.quote(testBatch, undefined, { validateResult: false }), `fallback_quotes_${scrId}`);
                quotes = Array.isArray(batchResult)
                    ? batchResult.filter(q => q && (q.regularMarketPrice !== undefined || q.regularMarketChangePercent !== undefined))
                    : [];

                // Sort based on the requested screener type
                if (scrId === 'day_gainers') {
                    quotes.sort((a: any, b: any) => (b.regularMarketChangePercent || 0) - (a.regularMarketChangePercent || 0));
                } else if (scrId === 'day_losers') {
                    quotes.sort((a: any, b: any) => (a.regularMarketChangePercent || 0) - (b.regularMarketChangePercent || 0));
                } else if (scrId === 'most_actives') {
                    quotes.sort((a: any, b: any) => (b.regularMarketVolume || 0) - (a.regularMarketVolume || 0));
                }
            }

            // Map and return results
            const stocks: Partial<Stock>[] = quotes
                .filter((quote: any) =>
                    quote && quote.symbol && (
                        quote.symbol.endsWith('.NS') ||
                        quote.symbol.endsWith('.BO') ||
                        quote.currency === 'INR' ||
                        quote.fullExchangeName?.includes('NSE') ||
                        quote.fullExchangeName?.includes('BSE')
                    )
                )
                .slice(0, count)
                .map((quote: any) => ({
                    symbol: quote.symbol,
                    name: quote.longName || quote.shortName || quote.symbol,
                    price: quote.regularMarketPrice || 0,
                    change: quote.regularMarketChange || 0,
                    changePercent: quote.regularMarketChangePercent || 0,
                    marketCap: quote.marketCap || 0,
                    volume: quote.regularMarketVolume || 0,
                    currency: quote.currency || 'INR',
                    lastUpdated: new Date()
                }));

            CacheUtils.set(cacheKey, stocks);
            return stocks;
        } catch (error: any) {
            if (error.name === 'FailedYahooValidationError' && error.result) {
                console.warn(`[StockIntel] Recovered from Yahoo Validation Error for ${scrId}`);
            }
            console.error(`Error in getScreenerData for ${scrId}:`, error);
            const fallback = CacheUtils.getFallback(cacheKey);
            return fallback || [];
        }
    }
}
