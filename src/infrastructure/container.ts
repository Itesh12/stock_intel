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
import { AutoTradeLogRepository } from "../domain/auto-trade-log";
import { MongoAutoTradeLogRepository } from "../adapters/mongodb/auto-trade-log-repo";
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

// Detect if running during Next.js compilation/build phase
const isBuildPhase =
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.IS_BUILD === "true" ||
    (process.env.NODE_ENV === "production" && !process.env.NEXT_RUNTIME);

let isShuttingDown = false;

if (!isBuildPhase) {
    const shutdown = () => {
        if (isShuttingDown) return;
        isShuttingDown = true;
        console.log("[Worker] Gracefully stopping all background loops...");
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
}

function startWorkerLoop(
    name: string,
    task: () => Promise<void>,
    intervalMs: number,
    globalFlag: string
) {
    if (isBuildPhase) {
        return;
    }

    if ((global as any)[globalFlag]) {
        return;
    }
    (global as any)[globalFlag] = true;

    console.log(`[Worker] ${name} successfully initialized.`);

    let isExecuting = false;

    const run = async () => {
        if (isShuttingDown) return;
        if (isExecuting) {
            Logger.skipped('Worker', name, 'previous execution still running');
            return;
        }

        isExecuting = true;
        const workerStart = Date.now();
        Logger.started('Worker', name);
        try {
            await task();
            const durationMs = Date.now() - workerStart;
            MetricsRegistry.recordWorkerEnd(name, true, durationMs);
            Logger.info('Worker', name, undefined, durationMs);
        } catch (err) {
            const durationMs = Date.now() - workerStart;
            MetricsRegistry.recordWorkerEnd(name, false, durationMs);
            Logger.error('Worker', name, err, undefined, durationMs);
        } finally {
            isExecuting = false;
            if (!isShuttingDown) {
                setTimeout(run, intervalMs);
            }
        }
    };

    // 5-second initial boot delay to prioritize HTTP server startup
    setTimeout(run, 5000);
}

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
    autoTradeLog: AutoTradeLogRepository;
    strategyAssistant: StrategyAssistantRepository;
    mongoClient: MongoClient | null;
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
    let autoTradeLogRepo: AutoTradeLogRepository;
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
        autoTradeLogRepo = new MongoAutoTradeLogRepository(db);
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
        autoTradeLogRepo = new MongoAutoTradeLogRepository({} as any);
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
        autoTradeLog: autoTradeLogRepo!,
        strategyAssistant: strategyAssistantRepo!,
        mongoClient: mongoClient,
    };

    // Step 1: Background simulation monitor loop (runs every 15 seconds)
    startWorkerLoop(
        "TradeMonitor",
        async () => {
            const monitor = new TradeMonitorService(cachedInfra!);
            await monitor.monitorAll();
        },
        15000,
        "tradeMonitorStarted"
    );



    // Step 3: Strategy Assistants background loop (runs every 30 seconds)
    if (process.env.ENABLE_STRATEGY_ASSISTANTS === "true") {
        startWorkerLoop(
            "StrategyAssistant",
            async () => {
                const processor = new SignalProcessor(cachedInfra!);
                await processor.runAll();
            },
            30000,
            "strategyAssistantStarted"
        );
    }

    return cachedInfra as Infrastructure;
}
