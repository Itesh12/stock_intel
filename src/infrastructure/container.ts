import { MongoClient, Db } from "mongodb";
import { Pool } from "pg";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
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
import { MongoJournalRepository } from "../adapters/mongodb/journal-repo";
import { MongoAlertRepository } from "../adapters/mongodb/alert-repo";
import { NotificationRepository } from "../ports/notification-repository";
import { MongoNotificationRepository } from "../adapters/mongodb/notification-repo";
import { AssistantLogRepository } from "../domain/assistant-log";
import { MongoAssistantLogRepository } from "../adapters/mongodb/assistant-log-repo";
import { StrategyAssistantRepository } from "../domain/strategy-assistant";
import { MongoStrategyAssistantRepository } from "../adapters/mongodb/strategy-assistant-repo";

// Postgres Adapters
import { PostgresStockRepository } from "../adapters/postgres/stock-repo";
import { PostgresPortfolioRepository } from "../adapters/postgres/portfolio-repo";

// Market Adapters
import { FinnhubMarketAdapter } from "../adapters/finnhub/market-adapter";
import { YahooFinanceMarketAdapter } from "../adapters/yahoo/market-adapter";
import { NoOpMarketAdapter } from "../adapters/noop/market-data-adapter";
import { HybridMarketAdapter } from "../adapters/hybrid/market-adapter";
import { TradeMonitorService } from "../application/trade-monitor-service";
import { SignalProcessor } from "../application/signal-processor";
import { MetricsRegistry } from "./metrics";
import { Logger } from "./logger";
import { WorkerManager } from "./worker-manager";

// Detect if running during Next.js compilation/build phase
const isBuildPhase =
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.IS_BUILD === "true" ||
    (process.env.NODE_ENV === "production" && !process.env.NEXT_RUNTIME);

export interface Infrastructure {
    stock: StockRepository;
    portfolio: PortfolioRepository;
    user: UserRepository;
    trade: TradeRepository;
    watchlist: WatchlistRepository;
    analytics: AnalyticsRepository;
    limitOrder: LimitOrderRepository;
    strategy: StrategyRepository;
    journal: MongoJournalRepository;
    alert: MongoAlertRepository;
    notification: NotificationRepository;
    market: MarketDataPort;
    assistantLog: AssistantLogRepository;
    strategyAssistant: StrategyAssistantRepository;
    mongoClient: MongoClient | null;
    workerManager: WorkerManager;
}

const requiredEnv = [
   "DB_DRIVER",
   "MONGO_URI",
   "MONGO_DB",
   "NEXTAUTH_URL",
   "NEXTAUTH_SECRET"
];

function checkAndInitializeEnv() {
    const isProduction = process.env.NODE_ENV === 'production';

    if (!isProduction) {
        // Local development only: attempt to load .env / .env.example
        const rootDir = process.cwd();
        const envPath = path.join(rootDir, '.env');
        const examplePath = path.join(rootDir, '.env.example');

        let envExists = fs.existsSync(envPath);
        if (!envExists) {
            if (fs.existsSync(examplePath)) {
                console.log('[Env] .env not found. Copying values from .env.example...');
                fs.copyFileSync(examplePath, envPath);
                envExists = true;
            } else {
                console.warn('[Env] Neither .env nor .env.example found.');
            }
        }

        if (envExists) {
            dotenv.config({ path: envPath });
        }
    }
    // In production (Vercel/cloud): env vars are injected by the platform.
    // Never call dotenv.config() — it would overwrite platform vars with
    // stale .env.example values (e.g. mongodb://localhost:27017 → ECONNREFUSED).

    // Validate required vars are present (from whichever source they came)
    const missing: string[] = [];
    const found: string[] = [];

    for (const key of requiredEnv) {
        if (!process.env[key]) {
            missing.push(key);
        } else {
            found.push(key);
        }
    }

    Logger.info('Env', 'startup_check', { found: found.join(', '), environment: process.env.NODE_ENV });
    if (missing.length > 0) {
        const msg = `${missing.join(', ')} missing. Please configure environment variables.`;
        if (isProduction) {
            // In production, log the error but do not throw at module load time.
            // The actual DB connection will fail with a clearer message if truly missing.
            Logger.error('Env', 'missing_vars', msg, { missing: missing.join(', ') });
        } else {
            Logger.error('Env', 'missing_vars', msg, { missing: missing.join(', ') });
            throw new Error(msg);
        }
    }

}

let cachedInfra: Infrastructure | null = null;

export async function getInfrastructure(): Promise<Infrastructure> {
    checkAndInitializeEnv();
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
    let journalRepo: MongoJournalRepository;
    let alertRepo: MongoAlertRepository;
    let notificationRepo: NotificationRepository;
    let assistantLogRepo: AssistantLogRepository;
    let strategyAssistantRepo: StrategyAssistantRepository;

    const yahooAdapter = new YahooFinanceMarketAdapter();
    const finnhubAdapter = apiKey ? new FinnhubMarketAdapter(apiKey) : null;
    const marketAdapter = new HybridMarketAdapter(yahooAdapter, finnhubAdapter);

    let mongoClient: MongoClient | null = null;

    if (dbDriver === "mongo") {
        const mongoUri = process.env.MONGO_URI;
        if (!mongoUri) {
            throw new Error("MONGO_URI missing from environment variables");
        }
        const client = await MongoClient.connect(mongoUri);
        mongoClient = client;
        const db = client.db(process.env.MONGO_DB || "market");
        stockRepo = new MongoStockRepository(db);
        portfolioRepo = new MongoPortfolioRepository(db);
        userRepo = new MongoUserRepository(db);
        tradeRepo = new MongoTradeRepository(db);
        watchlistRepo = new MongoWatchlistRepository(db);
        analyticsRepo = new MongoAnalyticsRepository(db);
        limitOrderRepo = new MongoLimitOrderRepository(db);
        strategyRepo = new MongoStrategyRepository(db);
        journalRepo = new MongoJournalRepository(db);
        alertRepo = new MongoAlertRepository(db);
        notificationRepo = new MongoNotificationRepository(db);
        assistantLogRepo = new MongoAssistantLogRepository(db);
        strategyAssistantRepo = new MongoStrategyAssistantRepository(db);
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
        journalRepo = new MongoJournalRepository({} as any);
        alertRepo = new MongoAlertRepository({} as any);
        notificationRepo = new MongoNotificationRepository({} as any);
        assistantLogRepo = new MongoAssistantLogRepository({} as any);
        strategyAssistantRepo = new MongoStrategyAssistantRepository({} as any);
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
        journal: journalRepo,
        alert: alertRepo,
        notification: notificationRepo,
        market: marketAdapter,
        assistantLog: assistantLogRepo!,
        strategyAssistant: strategyAssistantRepo!,
        mongoClient: mongoClient,
        workerManager: null as any,
    };

    const workerManager = new WorkerManager(cachedInfra as Infrastructure);
    (cachedInfra as any).workerManager = workerManager;

    if (!isBuildPhase) {
        workerManager.startAll();
    }

    return cachedInfra as Infrastructure;
}
