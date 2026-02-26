import { MongoClient, Db } from "mongodb";
import { Pool } from "pg";
import { StockRepository } from "../ports/stock-repository";
import { PortfolioRepository } from "../ports/portfolio-repository";
import { MarketDataPort } from "../ports/market-data-port";
import { UserRepository } from "../ports/user-repository";
import { TradeRepository } from "../ports/trade-repository";

// MongoDB Adapters
import { MongoStockRepository } from "../adapters/mongodb/stock-repo";
import { MongoPortfolioRepository } from "../adapters/mongodb/portfolio-repo";
import { MongoUserRepository } from "../adapters/mongodb/user-repo";
import { MongoTradeRepository } from "../adapters/mongodb/trade-repo";
import { WatchlistRepository } from "../ports/watchlist-repository";
import { StrategyRepository } from "../ports/strategy-repository";
import { AnalyticsRepository } from "../domain/analytics";
import { MongoWatchlistRepository } from "../adapters/mongodb/watchlist-repo";
import { MongoAnalyticsRepository } from "../adapters/mongodb/analytics-repo";
import { LimitOrderRepository } from "../domain/limit-order";
import { MongoLimitOrderRepository } from "../adapters/mongodb/limit-order-repo";
import { MongoStrategyRepository } from "../adapters/mongodb/strategy-repo";

// Postgres Adapters
import { PostgresStockRepository } from "../adapters/postgres/stock-repo";
import { PostgresPortfolioRepository } from "../adapters/postgres/portfolio-repo";

// Market Adapters
import { FinnhubMarketAdapter } from "../adapters/finnhub/market-adapter";
import { YahooFinanceMarketAdapter } from "../adapters/yahoo/market-adapter";
import { NoOpMarketAdapter } from "../adapters/noop/market-data-adapter";

export interface Infrastructure {
    stock: StockRepository;
    portfolio: PortfolioRepository;
    user: UserRepository;
    trade: TradeRepository;
    watchlist: WatchlistRepository;
    analytics: AnalyticsRepository;
    limitOrder: LimitOrderRepository;
    strategy: StrategyRepository;
    market: MarketDataPort;
}

let cachedInfra: Infrastructure | null = null;

export async function getInfrastructure(): Promise<Infrastructure> {
    if (cachedInfra) return cachedInfra;

    const dbDriver = process.env.DB_DRIVER || "mongo";
    const apiKey = process.env.FINNHUB_API_KEY;

    let stockRepo: StockRepository;
    let portfolioRepo: PortfolioRepository;
    let userRepo: UserRepository;
    let tradeRepo: TradeRepository;
    let watchlistRepo: WatchlistRepository;
    let analyticsRepo: AnalyticsRepository;
    let limitOrderRepo: LimitOrderRepository;
    let strategyRepo: StrategyRepository;

    // Use Yahoo Finance as primary for free real-time support (NSE/BSE)
    // Finnhub can be used if API key is provided for US stocks
    const marketAdapter = apiKey
        ? new FinnhubMarketAdapter(apiKey)
        : new YahooFinanceMarketAdapter();

    if (dbDriver === "mongo") {
        const client = await MongoClient.connect(process.env.MONGO_URI || "mongodb://localhost:27017");
        const db = client.db(process.env.MONGO_DB || "market");
        stockRepo = new MongoStockRepository(db);
        portfolioRepo = new MongoPortfolioRepository(db);
        userRepo = new MongoUserRepository(db);
        tradeRepo = new MongoTradeRepository(db);
        watchlistRepo = new MongoWatchlistRepository(db);
        analyticsRepo = new MongoAnalyticsRepository(db);
        limitOrderRepo = new MongoLimitOrderRepository(db);
        strategyRepo = new MongoStrategyRepository(db);
    } else {
        const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
        stockRepo = new PostgresStockRepository(pool);
        portfolioRepo = new PostgresPortfolioRepository(pool);
        // Fallback for user and trade repo in Postgres if not implemented
        userRepo = new MongoUserRepository({} as any);
        tradeRepo = new MongoTradeRepository({} as any);
        watchlistRepo = new MongoWatchlistRepository({} as any);
        analyticsRepo = new MongoAnalyticsRepository({} as any);
        limitOrderRepo = new MongoLimitOrderRepository({} as any);
        strategyRepo = new MongoStrategyRepository({} as any);
    }

    cachedInfra = {
        stock: stockRepo,
        portfolio: portfolioRepo,
        user: userRepo,
        trade: tradeRepo,
        watchlist: watchlistRepo,
        analytics: analyticsRepo,
        limitOrder: limitOrderRepo,
        strategy: strategyRepo,
        market: marketAdapter,
    };

    return cachedInfra;
}
