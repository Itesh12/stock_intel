import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// 1. Detect whether .env exists, if not, copy from .env.example
const rootDir = process.cwd();
const envPath = path.join(rootDir, ".env");
const examplePath = path.join(rootDir, ".env.example");

let envDetected = fs.existsSync(envPath);
if (!envDetected) {
    if (fs.existsSync(examplePath)) {
        fs.copyFileSync(examplePath, envPath);
        envDetected = true;
    }
}

// 2. Load environment variables
dotenv.config();

const requiredEnv = [
   "DB_DRIVER",
   "MONGO_URI",
   "MONGO_DB",
   "NEXTAUTH_URL",
   "NEXTAUTH_SECRET"
];

const missing: string[] = [];
const found: string[] = [];

for (const key of requiredEnv) {
    if (!process.env[key]) {
        missing.push(key);
    } else {
        found.push(key);
    }
}

console.log("=== ENVIRONMENT VALIDATION ===");
console.log(`* .env detected: ${envDetected ? "YES" : "NO"}`);
console.log(`* variables loaded: ${found.join(", ")}`);
if (missing.length > 0) {
    console.log(`* missing variables: ${missing.join(", ")}`);
} else {
    console.log(`* missing variables: NONE`);
}

const mongoUri = process.env.MONGO_URI;
console.log(`* Mongo URI detected: ${mongoUri ? "YES" : "NO"}`);

import { getInfrastructure } from "../src/infrastructure/container";
import { v4 as uuidv4 } from "uuid";

class TradeValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "TradeValidationError";
    }
}

async function testMongoConcurrency() {
    let connectionSuccess = false;
    let connectionError: any = null;
    let infra: any = null;

    try {
        infra = await getInfrastructure();
        if (infra.mongoClient) {
            // Test actual ping to verify active connection
            await infra.mongoClient.db().command({ ping: 1 });
            connectionSuccess = true;
        }
    } catch (err: any) {
        connectionError = err.message || err;
    }

    console.log(`* DB connection success/failure: ${connectionSuccess ? "SUCCESS" : "FAILURE (" + connectionError + ")"}`);

    if (!connectionSuccess) {
        console.log(`\nVerification Status: FAIL (DB connection failed: ${connectionError})`);
        process.exit(1);
    }

    const userId = "mongo-concurrency-test";
    const portfolioId = uuidv4();
    const symbol = "RELIANCE.NS";
    const stockPrice = 1000;

    const db = infra.mongoClient.db(process.env.MONGO_DB || "market");

    // 1. Setup: Clear existing test records
    console.log("\nInitializing collections: clearing prior test-user records...");
    await db.collection("portfolios").deleteMany({ userId });
    await db.collection("trades").deleteMany({ userId });
    await db.collection("limit_orders").deleteMany({ userId });
    await db.collection("idempotency_keys").deleteMany({ key: { $regex: "^mongo-concurrency-test-" } });

    // 2. Setup: Create initial portfolio with ₹10,00,000 cash
    const initialPortfolio = {
        id: portfolioId,
        userId,
        name: "Mongo Concurrency Validation Portfolio",
        holdings: [],
        totalValue: 1000000,
        totalPL: 0,
        totalPLPercent: 0,
        cashBalance: 1000000,
        riskScore: 0,
        sectorExposure: {},
        version: 0,
        updatedAt: new Date(),
        createdAt: new Date()
    };

    console.log("Creating starting portfolio with ₹10,00,000 cash...");
    await infra.portfolio.save(initialPortfolio);

    // 3. Define 10 mixed trade values
    const tradeValues = [
        100000, // ₹100k
        50000,  // ₹50k
        200000, // ₹200k
        150000, // ₹150k
        300000, // ₹300k
        100000, // ₹100k
        250000, // ₹250k
        400000, // ₹400k
        50000,  // ₹50k
        100000  // ₹100k
    ];
    // Total cost = ₹1,700,000. Under ₹1,000,000 initial balance, only some can succeed.

    let occRetriesCount = 0;
    let transactionFailuresCount = 0;

    // Helper to simulate request worker threads
    const runTradeRequest = async (index: number, value: number) => {
        const totalCost = value;
        const quantity = Math.floor(value / stockPrice);
        const idempotencyKey = `mongo-concurrency-test-key-${index}-${value}`;
        const idempotencyCollection = db.collection("idempotency_keys");

        // Idempotency check
        const existing = await idempotencyCollection.findOne({ key: idempotencyKey });
        if (existing) {
            if (existing.status === "COMPLETED") return { success: true, value, cached: true };
            if (existing.status === "PROCESSING") throw new Error("Duplicate request in progress");
        }

        try {
            await idempotencyCollection.insertOne({
                key: idempotencyKey,
                status: "PROCESSING",
                createdAt: new Date()
            });
        } catch {
            return { success: false, value, error: "Idempotency insertion conflict" };
        }

        const MAX_ATTEMPTS = 3;
        let attempt = 0;
        let success = false;
        let validationError: string | null = null;

        while (attempt < MAX_ATTEMPTS && !success) {
            attempt++;
            const txSession = infra.mongoClient ? infra.mongoClient.startSession() : null;

            try {
                const executeTradeInTransaction = async (session?: any) => {
                    // Reload latest portfolio from DB (OCC check safety)
                    const portfolios = await infra.portfolio.findByUserId(userId, session);
                    const portfolio = portfolios[0];
                    if (!portfolio) {
                        throw new Error("Portfolio document not found");
                    }

                    // Revalidate balance constraints
                    if (portfolio.cashBalance < totalCost) {
                        throw new TradeValidationError(`Insufficient virtual funds: needed ₹${totalCost}, balance is ₹${portfolio.cashBalance}`);
                    }

                    // Update holdings
                    const holdingIndex = portfolio.holdings.findIndex((h: any) => h.symbol === symbol);
                    if (holdingIndex >= 0) {
                        const existingHolding = portfolio.holdings[holdingIndex];
                        const newQty = existingHolding.quantity + quantity;
                        const newAvg = (existingHolding.averagePrice * existingHolding.quantity + totalCost) / newQty;

                        portfolio.holdings[holdingIndex] = {
                            ...existingHolding,
                            quantity: newQty,
                            averagePrice: newAvg,
                            currentPrice: stockPrice,
                            marketValue: newQty * stockPrice,
                            unrealizedPL: 0,
                            unrealizedPLPercent: 0
                        };
                    } else {
                        portfolio.holdings.push({
                            id: uuidv4(),
                            symbol,
                            quantity,
                            averagePrice: stockPrice,
                            currentPrice: stockPrice,
                            marketValue: totalCost,
                            unrealizedPL: 0,
                            unrealizedPLPercent: 0,
                            sector: "Energy",
                            weight: 0
                        });
                    }

                    portfolio.cashBalance -= totalCost;
                    portfolio.totalValue = portfolio.cashBalance + portfolio.holdings.reduce((sum: number, h: any) => sum + h.marketValue, 0);
                    portfolio.updatedAt = new Date();

                    // Save portfolio (runs OCC version check filter)
                    await infra.portfolio.save(portfolio, session);

                    // Save Trade record in ledger
                    await infra.trade.save({
                        id: uuidv4(),
                        userId,
                        symbol,
                        quantity,
                        price: stockPrice,
                        totalValue: totalCost,
                        type: 'BUY',
                        source: 'manual',
                        timestamp: new Date()
                    }, session);
                };

                // Execute with transactional wrapper. Fallback to OCC only if transactions are not supported (standalone MongoDB).
                try {
                    if (txSession) {
                        await txSession.withTransaction(async () => {
                            await executeTradeInTransaction(txSession);
                        });
                    } else {
                        await executeTradeInTransaction();
                    }
                } catch (txErr: any) {
                    const isTxNotSupported = 
                        txErr.message?.includes("Transaction numbers are only allowed") ||
                        txErr.code === 251;
                    
                    if (isTxNotSupported) {
                        transactionFailuresCount++;
                        await executeTradeInTransaction(); // Run without transactional session (fallback)
                    } else {
                        throw txErr;
                    }
                }

                success = true;
            } catch (err: any) {
                if (txSession && txSession.inTransaction()) {
                    await txSession.abortTransaction().catch(() => {});
                }

                if (err instanceof TradeValidationError) {
                    validationError = err.message;
                    break; // Business validation failures should immediately abort (do not retry)
                }

                const isVersionConflict = err.message?.includes("VersionConflictError");
                if (isVersionConflict && attempt < MAX_ATTEMPTS) {
                    occRetriesCount++;
                    // Jittered backoff delay to allow the competing operation to finish
                    await new Promise(resolve => setTimeout(resolve, attempt * 50));
                    continue;
                }

                validationError = err.message || "Unknown execution error";
                break;
            } finally {
                if (txSession) {
                    await txSession.endSession();
                }
            }
        }

        if (success) {
            await idempotencyCollection.updateOne(
                { key: idempotencyKey },
                { $set: { status: "COMPLETED", completedAt: new Date() } }
            );
            return { success: true, value };
        } else {
            await idempotencyCollection.updateOne(
                { key: idempotencyKey },
                { $set: { status: "FAILED", error: validationError, failedAt: new Date() } }
            );
            return { success: false, error: validationError, value };
        }
    };

    console.log("\n--- Dispatching 10 Concurrent BUY Requests ---");
    const results = await Promise.all(tradeValues.map((val, idx) => runTradeRequest(idx, val)));

    // 4. Reload final records from MongoDB to run assertion audits
    const finalPortfolios = await infra.portfolio.findByUserId(userId);
    const portfolio = finalPortfolios[0];
    const trades = await infra.trade.findByUserId(userId);

    const successfulTrades = results.filter(r => r.success);
    const failedTrades = results.filter(r => !r.success);

    const duplicateTradeIds = trades.map((t: any) => t.id).filter((id: string, idx: number, self: string[]) => self.indexOf(id) !== idx);
    const negativeBalanceDetected = portfolio.cashBalance < 0;

    const totalTradesCost = successfulTrades.reduce((sum, t) => sum + t.value, 0);

    // Assert actual holdings quantity match ledger trade items
    const ledgerQty = trades.reduce((sum: number, t: any) => sum + t.quantity, 0);
    const holdingsQty = portfolio.holdings.reduce((sum: number, h: any) => sum + h.quantity, 0);
    const holdingsConsistent = ledgerQty === holdingsQty;

    // Assert final version logic matches expectations (init version 1 + succeeded updates)
    const expectedVersion = 1 + successfulTrades.length;
    const versionCorrect = portfolio.version === expectedVersion;

    console.log("\n=== FINAL MONGO VALIDATION ===\n");
    console.log(`- Final Portfolio Version: ${portfolio.version}`);
    console.log(`- Cash Balance: ₹${portfolio.cashBalance.toLocaleString()}`);
    console.log(`- Successful Trades: ${successfulTrades.length}`);
    console.log(`- Failed Trades: ${failedTrades.length}`);
    console.log(`- Trade Count (Ledger): ${trades.length}`);
    console.log(`- Duplicate IDs: ${duplicateTradeIds.length}`);
    console.log(`- Version Increments: ${versionCorrect ? "CORRECT" : "INCORRECT"} (Expected ${expectedVersion}, got ${portfolio.version})`);
    console.log(`- Negative Balance Detection: ${negativeBalanceDetected ? "DETECTED" : "NONE"}`);
    console.log(`- Holdings Consistency: ${holdingsConsistent ? "CONSISTENT" : "INCONSISTENT"} (Ledger Qty: ${ledgerQty}, Holdings Qty: ${holdingsQty})`);
    console.log(`- OCC Retries: ${occRetriesCount}`);
    console.log(`- Transaction Failures (Standalone Fallbacks): ${transactionFailuresCount}`);

    const pass = 
        !negativeBalanceDetected && 
        duplicateTradeIds.length === 0 && 
        trades.length === successfulTrades.length &&
        holdingsConsistent &&
        versionCorrect;

    console.log(`\nVerification Status: ${pass ? "PASS" : "FAIL"}`);
    
    // Clean up test data
    console.log("\nCleaning up test data from MongoDB...");
    await db.collection("portfolios").deleteMany({ userId });
    await db.collection("trades").deleteMany({ userId });
    await db.collection("limit_orders").deleteMany({ userId });
    await db.collection("idempotency_keys").deleteMany({ key: { $regex: "^mongo-concurrency-test-" } });
    console.log("Cleanup complete!");

    process.exit(pass ? 0 : 1);
}

testMongoConcurrency().catch(err => {
    console.error("Mongo validation failed with uncaught exception:", err);
    process.exit(1);
});
