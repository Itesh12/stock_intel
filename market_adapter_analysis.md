# StockIntel Market Adapter Architecture Analysis

This document provides a complete technical analysis of the **Market Adapter Architecture** of **StockIntel**, including interface declarations, adapter implementations, caching mechanics, error recovery behaviors, and a guide for integrating the **DhanHQ** broker API as a replacement or extension.

---

## 1. Core Architecture Diagram

```
                     +---------------------------------------+
                     |    Application Layer (Use Cases)      |
                     |  (e.g., IntelligenceService, Scanners)|
                     +-------------------+-------------------+
                                         |
                                         v
                     +-------------------+-------------------+
                     |       [Port] MarketDataPort           |
                     |   (Interface defining fetch methods)  |
                     +-------------------+-------------------+
                                         |
                       +-----------------+-----------------+
                       |                                   |
                       v                                   v
        +--------------+--------------+     +--------------+--------------+
        |   YahooFinanceMarketAdapter  |     |     FinnhubMarketAdapter     |
        |  (yahoo-finance2 integration)|     |    (Finnhub REST API client) |
        +--------------+--------------+     +--------------+--------------+
                       |                                   |
                       v                                   v
             +---------+----------+             +----------+----------+
             | Yahoo Finance APIs |             |   Finnhub.io APIs   |
             +--------------------+             +---------------------+
```

---

## 2. Market Adapter Port & Methods Exposed

The interface **`MarketDataPort`** (`src/ports/market-data-port.ts`) defines the contract that all market adapters must implement:

```typescript
export interface MarketDataPort {
    // Fetches live price and fundamentals of a single stock symbol
    getStockPrice(symbol: string): Promise<Partial<Stock>>;
    
    // Fetches historical candles (date and close prices) over a defined range
    getHistoricalData(symbol: string, period: string, fromDate?: Date): Promise<any[]>;
    
    // Calculates absolute and percentage price returns for a specific timeframe
    getPerformance(symbol: string, period: string): Promise<Partial<Stock> & {
        change: number;
        changePercent: number;
        currentPrice: number;
        low?: number;
        high?: number;
    }>;
    
    // Searches for matching stock symbols based on user text query
    searchStocks(query: string): Promise<Partial<Stock>[]>;
    
    // Queries market screener groups (e.g. day_gainers, most_actives)
    getScreenerData(scrId: string, count?: number): Promise<Partial<Stock>[]>;
    
    // Fetches news articles related to a specific company or index
    getNews(symbol: string, count?: number): Promise<any[]>;
}
```

---

## 3. Adapter Implementations & Data Fetching Flows

### A. Yahoo Finance Adapter (`src/adapters/yahoo/market-adapter.ts`)
*   **Quote Fetching**: Utilizes `yahooFinance.quote(symbol)` to pull current trading prices, and `yahooFinance.quoteSummary(symbol, { modules: [...] })` to pull corporate fundamentals (financialData, defaultKeyStatistics, summaryDetail).
*   **Historical Data**: Calls `yahooFinance.chart(symbol, { period1, period2, interval })`. Dynamically maps intervals: `2m` for intraday (`1d` range), `1d` for short ranges, and `1wk` or `1mo` for massive long-term queries (`5y` or `all`).
*   **News Fetching**: Calls `yahooFinance.search(searchQuery, { newsCount })`. Resolves the search query dynamically using both the company's full long name and ticker symbol to optimize result relevance.
*   **Market Scan & Curated Indian Fallback**:
    1.  Tries querying predefined screeners via `yahooFinance.screener({ scrIds: scrId, region: 'IN' })`.
    2.  If Yahoo returns no results or defaults to US listings (a common bug in standard screener APIs), the adapter executes a **smart fallback**:
        *   Loads the complete list of ~8,000 Indian stock symbols from `src/data/indian-symbols.json`.
        *   Takes a subset: combines high-liquidity seed symbols (e.g. `RELIANCE.NS`, `TCS.NS`, `HDFCBANK.NS`) with a shuffled random sample of 150 tickers.
        *   Performs a batch quote call to Yahoo Finance.
        *   Sorts the resulting list on the server (by percentage change for Gainers/Losers, and volume for Most Actives) to build the screener payload.

### B. Finnhub Adapter (`src/adapters/finnhub/market-adapter.ts`)
*   **Quote Fetching**: Hits `/quote?symbol={symbol}&token={token}` REST endpoint.
*   **Historical Data**: Hits `/stock/candle` mapping Unix timestamps.
*   **Screener and News**: Restricted or returns empty lists on the free tier. Primarily acts as a high-fidelity backup for US stock quotes.

---

## 4. Caching & Resilience Patterns

### In-Memory Cache Utilities (`src/infrastructure/cache-utils.ts`)
*   Uses a simple, static key-value store object (`Record<string, CacheEntry>`).
*   Stores data structures alongside timestamps (`timestamp: Date.now()`).
*   Exposes:
    *   `set(key, data)`: Caches valid payloads.
    *   `get(key, ttl)`: Checks if the entry exists and ensures its age does not exceed the TTL (e.g. 15 seconds for live stock quotes).
    *   `getFallback(key)`: Returns cached data **even if expired** to act as a resilient fallback in the event of transient network drops.

### Connection Resilience & Retry Loop
*   `YahooFinanceMarketAdapter` embeds a retry mechanism (`withRetry` helper):
    ```typescript
    private async withRetry<T>(fn: () => Promise<T>, symbol: string, retries = 3, delay = 2000): Promise<T | null> {
        try {
            return await fn();
        } catch (error: any) {
            const isConnectionError = error.code === 'ECONNRESET' || 
                                      error.cause?.code === 'ECONNRESET' ||
                                      error.message?.includes('fetch failed');
            if (retries > 0 && isConnectionError) {
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.withRetry(fn, symbol, retries - 1, delay * 2); // Exponential backoff
            }
            throw error;
        }
    }
    ```

### Batch Fetching
*   In the scanner modules (`src/services/quant-scanner.ts`), querying 100+ stock details sequentially would fail due to timeouts and rate limit blocks. The system chunks tickers into arrays of 150:
    ```typescript
    const chunks = chunkArray(uniqueSymbols, 150);
    await Promise.all(chunks.map(async (chunk) => {
        const batchResult = await yahooFinance.quote(chunk, undefined, { validateResult: false });
        liveBasicQuotes.push(...batchResult);
    }));
    ```
    This executes parallel batch queries, allowing the system to scan and filter 800+ stocks in under 5 seconds.

---

## 5. Integrating DhanHQ as a New Provider

**DhanHQ** is a leading Indian broker platform providing REST and WebSocket APIs. Here is the step-by-step path to hook it into StockIntel's DI structure:

### Step 1: Declare Environment Configuration
Add authorization keys to `.env`:
```bash
MARKET_PROVIDER=dhan
DHAN_CLIENT_ID=your_dhan_client_id
DHAN_ACCESS_TOKEN=your_dhan_access_token
```

### Step 2: Implement DhanHQ Adapter
Create `src/adapters/dhan/market-adapter.ts` wrapping Dhan API requests:
```typescript
import { MarketDataPort } from "../../ports/market-data-port";
import { Stock } from "../../domain/stock";

export class DhanHQMarketAdapter implements MarketDataPort {
    constructor(private clientId: string, private accessToken: string) {}

    async getStockPrice(symbol: string): Promise<Partial<Stock>> {
        // 1. Map stock symbol formats (e.g. 'RELIANCE.NS' -> Dhan security codes/ISIN)
        // 2. Fetch price from Dhan's quote API: /marketfeed-quotes
        // 3. Return mapped domain Stock entity
    }

    async getHistoricalData(symbol: string, period: string, fromDate?: Date): Promise<any[]> {
        // Query Dhan's historical charts API: /charts/historical
    }

    async getPerformance(symbol: string, period: string): Promise<any> { ... }
    async searchStocks(query: string): Promise<any> { ... }
    
    async getScreenerData(scrId: string, count = 25): Promise<any> {
        // Fallback to local Indian stock symbols batch quote checks
    }
    
    async getNews(symbol: string, count = 5): Promise<any[]> {
        // Dhan does not provide news. Fallback to Yahoo or public RSS feed.
    }
}
```

### Step 3: Register in Dependency Container
In `src/infrastructure/container.ts`, update dependency initialization:
```typescript
import { DhanHQMarketAdapter } from "../adapters/dhan/market-adapter";

export async function getInfrastructure(): Promise<Infrastructure> {
    // ...
    const marketProvider = process.env.MARKET_PROVIDER || "yahoo";
    let marketAdapter: MarketDataPort;

    if (marketProvider === "dhan") {
        marketAdapter = new DhanHQMarketAdapter(
            process.env.DHAN_CLIENT_ID || "",
            process.env.DHAN_ACCESS_TOKEN || ""
        );
    } else if (process.env.FINNHUB_API_KEY) {
        marketAdapter = new FinnhubMarketAdapter(process.env.FINNHUB_API_KEY);
    } else {
        marketAdapter = new YahooFinanceMarketAdapter();
    }
    // ...
}
```

---

## 6. Risks of Replacing Yahoo Finance with DhanHQ

Replacing the Yahoo Finance adapter with DhanHQ introduces several architectural risks:

1.  **Rate Limits & Concurrent Scans**:
    Dhan's APIs are rate-limited for retail algorithmic operations. The quantitative scanners (`BuffetScanner`, `CanslimScanner`) fetch details for hundreds of candidates concurrently. Dhan's API keys might block these batch queries, causing scanner execution failures unless request queuing/throttling is added.
2.  **No Global Market Coverage**:
    Dhan is an Indian-only broker (NSE/BSE). Replacing Yahoo Finance entirely will break all US stock tracking (e.g. `AAPL`, `NVDA`, `AMD` dashboard lists) and global market indices updates.
3.  **Missing Fundamental Data Modules**:
    Dhan focuses on transaction mechanics, historical candles, and live ticks. It does not provide detailed corporate balance sheets, trailing P/E ratios, ROE, operating margins, or earnings growth metrics. Quantitative scanners and scoring engines will find these fields empty, breaking the scoring engines.
4.  **No News API**:
    Dhan does not provide news feeds. Replacing Yahoo Finance entirely would break the news sentiment analysis modules (`NewsService`) unless news operations are routed to a separate news feed provider.
5.  **Token Expiration Cycles**:
    Dhan requires regular token updates and daily authentication procedures. Incorporating it requires building a token manager to handle session refreshes, whereas Yahoo Finance is stateless.
