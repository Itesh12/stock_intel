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
import { AutoTradeBotRepository } from "../domain/auto-trade-bot";
import { MongoAutoTradeBotRepository } from "../adapters/mongodb/auto-trade-bot-repo";

// Postgres Adapters
import { PostgresStockRepository } from "../adapters/postgres/stock-repo";
import { PostgresPortfolioRepository } from "../adapters/postgres/portfolio-repo";

// Market Adapters
import { FinnhubMarketAdapter } from "../adapters/finnhub/market-adapter";
import { YahooFinanceMarketAdapter } from "../adapters/yahoo/market-adapter";
import { NoOpMarketAdapter } from "../adapters/noop/market-data-adapter";
import { TradeMonitorService } from "../application/trade-monitor-service";
import { AutoTradeService } from "../application/auto-trade-service";

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
            console.warn(`[Worker] ${name} execution overlapped. Skipping current run.`);
            return;
        }

        isExecuting = true;
        try {
            await task();
        } catch (err) {
            console.error(`[Worker] ${name} execution error:`, err);
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
    autoTradeBot: AutoTradeBotRepository;
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
    const rootDir = process.cwd();
    const envPath = path.join(rootDir, ".env");
    const examplePath = path.join(rootDir, ".env.example");

    let envExists = fs.existsSync(envPath);
    if (!envExists) {
        if (fs.existsSync(examplePath)) {
            console.log("[Env] .env not found. Copying values from .env.example...");
            fs.copyFileSync(examplePath, envPath);
            envExists = true;
        } else {
            console.warn("[Env] Neither .env nor .env.example found.");
        }
    }

    if (envExists) {
        dotenv.config({ path: envPath });
    }

    // Run startup validation
    const missing: string[] = [];
    const found: string[] = [];

    for (const key of requiredEnv) {
        if (!process.env[key]) {
            missing.push(key);
        } else {
            found.push(key);
        }
    }

    console.log(`[Env] Found environment variables: ${found.join(", ")}`);
    if (missing.length > 0) {
        console.error(`[Env] Missing required variables: ${missing.join(", ")}`);
        throw new Error(`${missing.join(", ")} missing. Please configure .env`);
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
    let autoTradeBotRepo: AutoTradeBotRepository;

    // Use Yahoo Finance as primary for free real-time support (NSE/BSE)
    // Finnhub can be used if API key is provided for US stocks
    const marketAdapter = apiKey
        ? new FinnhubMarketAdapter(apiKey)
        : new YahooFinanceMarketAdapter();

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
        autoTradeBotRepo = new MongoAutoTradeBotRepository(db);
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
        autoTradeBotRepo = new MongoAutoTradeBotRepository({} as any);
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
        autoTradeBot: autoTradeBotRepo!,
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

    // Step 2: Auto Trade bot engine loop (runs every 30 seconds)
    startWorkerLoop(
        "AutoTrade",
        async () => {
            const service = new AutoTradeService(cachedInfra!);
            await service.runAllBots();
        },
        30000,
        "autoTradeStarted"
    );

    return cachedInfra as Infrastructure;
}
