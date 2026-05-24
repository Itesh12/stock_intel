import { v4 as uuidv4 } from "uuid";
import { Portfolio } from "../src/domain/portfolio";
import { Trade } from "../src/domain/trade";

async function runConcurrencyTest() {
    console.log("=== STARTING CONCURRENCY PROTECTION TEST (IN-MEMORY MOCK DB) ===");
    
    const userId = "concurrency-test-user-" + Math.floor(Math.random() * 10000);
    const portfolioId = uuidv4();
    const symbol = "RELIANCE.NS";

    // 1. Setup in-memory state tracking to simulate Mongo collections
    const mockDb = {
        portfolio: null as Portfolio | null,
        trades: [] as Trade[],
        versionConflicts: 0,
        successfulUpdates: 0,
        failedUpdates: 0
    };

    // Helper to simulate network latency to trigger race conditions
    const simulateNetworkLatency = () => new Promise(resolve => setTimeout(resolve, Math.random() * 30 + 10));

    // Mock Portfolio Repository with OCC check
    const mockPortfolioRepo = {
        async findByUserId(uid: string): Promise<Portfolio[]> {
            await simulateNetworkLatency();
            return mockDb.portfolio ? [JSON.parse(JSON.stringify(mockDb.portfolio))] : [];
        },
        
        async save(portfolio: Portfolio): Promise<void> {
            await simulateNetworkLatency();
            if (!mockDb.portfolio) {
                mockDb.portfolio = JSON.parse(JSON.stringify(portfolio));
                mockDb.portfolio!.version = 1;
                portfolio.version = 1;
                return;
            }

            const currentDbVersion = mockDb.portfolio.version || 0;
            const incomingVersion = portfolio.version || 0;

            if (incomingVersion !== currentDbVersion) {
                mockDb.versionConflicts++;
                throw new Error("VersionConflictError: Portfolio document was modified concurrently.");
            }

            const nextVersion = currentDbVersion + 1;
            mockDb.portfolio = JSON.parse(JSON.stringify(portfolio));
            mockDb.portfolio!.version = nextVersion;
            portfolio.version = nextVersion; // simulate auto-increment side effect
            mockDb.successfulUpdates++;
        }
    };

    // Mock Trade Repository
    const mockTradeRepo = {
        async save(trade: Trade): Promise<void> {
            await simulateNetworkLatency();
            mockDb.trades.push(JSON.parse(JSON.stringify(trade)));
        },
        async findByUserId(uid: string): Promise<Trade[]> {
            return mockDb.trades.filter(t => t.userId === uid);
        }
    };

    // 2. Initialize a clean Portfolio with ₹10,00,000 cash
    const initialPortfolio: Portfolio = {
        id: portfolioId,
        userId,
        name: "Test Concurrency Portfolio",
        holdings: [],
        totalValue: 1000000,
        totalPL: 0,
        totalPLPercent: 0,
        cashBalance: 1000000,
        riskScore: 0,
        sectorExposure: {},
        version: 1,
        updatedAt: new Date(),
        createdAt: new Date()
    };

    console.log("Creating initial portfolio with ₹10,00,000...");
    await mockPortfolioRepo.save(initialPortfolio);

    const runRequest = async (label: string, value: number, quantity: number) => {
        const totalCost = value;
        const MAX_ATTEMPTS = 3;
        let attempt = 0;
        let success = false;
        
        console.log(`[Request ${label}] Initiating BUY order of ₹${value} (qty: ${quantity})...`);

        while (attempt < MAX_ATTEMPTS && !success) {
            attempt++;
            try {
                // Reload latest portfolio from DB to get the most recent version
                const portfolios = await mockPortfolioRepo.findByUserId(userId);
                const portfolio = portfolios[0];
                if (!portfolio) {
                    throw new Error("Portfolio not found inside transaction context");
                }

                // Check balance constraints
                if (portfolio.cashBalance < totalCost) {
                    throw new Error(`Insufficient funds: needed ₹${totalCost}, but balance is ₹${portfolio.cashBalance}`);
                }

                // Update holdings
                const holdingIndex = portfolio.holdings.findIndex(h => h.symbol === symbol);
                if (holdingIndex >= 0) {
                    const existing = portfolio.holdings[holdingIndex];
                    const newQty = existing.quantity + quantity;
                    const newAvg = (existing.averagePrice * existing.quantity + totalCost) / newQty;

                    portfolio.holdings[holdingIndex] = {
                        ...existing,
                        quantity: newQty,
                        averagePrice: newAvg,
                        currentPrice: 1000,
                        marketValue: newQty * 1000,
                        unrealizedPL: 0,
                        unrealizedPLPercent: 0
                    };
                } else {
                    portfolio.holdings.push({
                        id: uuidv4(),
                        symbol,
                        quantity,
                        averagePrice: 1000,
                        currentPrice: 1000,
                        marketValue: totalCost,
                        unrealizedPL: 0,
                        unrealizedPLPercent: 0,
                        sector: "Energy",
                        weight: 0
                    });
                }

                portfolio.cashBalance -= totalCost;
                portfolio.totalValue = portfolio.cashBalance + portfolio.holdings.reduce((sum, h) => sum + h.marketValue, 0);
                portfolio.updatedAt = new Date();

                // Save portfolio (triggers version check inside repo)
                await mockPortfolioRepo.save(portfolio);

                // Save trade to ledger
                await mockTradeRepo.save({
                    id: uuidv4(),
                    userId,
                    symbol,
                    quantity,
                    price: 1000,
                    totalValue: totalCost,
                    type: 'BUY',
                    source: 'manual',
                    timestamp: new Date()
                });

                success = true;
                console.log(`[Request ${label}] Succeeded on attempt ${attempt}.`);
            } catch (err: any) {
                if (err.message.includes("Insufficient funds")) {
                    console.log(`[Request ${label}] Rejected on attempt ${attempt}: ${err.message}`);
                    break; // Do not retry business validation errors
                }

                const isVersionConflict = err.message?.includes("VersionConflictError");
                if (isVersionConflict && attempt < MAX_ATTEMPTS) {
                    console.warn(`[Request ${label}] OCC Version Conflict on attempt ${attempt}. Retrying trade...`);
                    // Delay slightly to allow other transactions to finish
                    await new Promise(resolve => setTimeout(resolve, attempt * 50));
                    continue;
                }

                console.error(`[Request ${label}] Failed permanently on attempt ${attempt}:`, err.message);
                break;
            }
        }

        return success;
    };

    console.log("\n--- Dispatching Concurrent Trade Requests ---");
    // Fire A, B, and C concurrently
    const results = await Promise.all([
        runRequest("A", 100000, 100), // ₹100,000
        runRequest("B", 50000, 50),   // ₹50,000
        runRequest("C", 900000, 900)  // ₹900,000
    ]);

    console.log("\n--- Verification and Analysis ---");
    console.log(`Request A Result: ${results[0] ? "SUCCESS" : "FAILED"}`);
    console.log(`Request B Result: ${results[1] ? "SUCCESS" : "FAILED"}`);
    console.log(`Request C Result: ${results[2] ? "SUCCESS" : "FAILED"}`);

    console.log("\n--- Final Database Records ---");
    console.log(`Portfolio Version: ${mockDb.portfolio?.version}`);
    console.log(`Portfolio Cash Balance: ₹${mockDb.portfolio?.cashBalance.toLocaleString()}`);
    console.log(`Portfolio Total Value: ₹${mockDb.portfolio?.totalValue.toLocaleString()}`);
    console.log(`Portfolio Holdings Quantity: ${mockDb.portfolio?.holdings[0]?.quantity || 0} shares`);
    console.log(`Total Trade Logs Written: ${mockDb.trades.length}`);
    console.log(`Total Version Conflict Retries: ${mockDb.versionConflicts}`);
    
    console.log("=== CONCURRENCY PROTECTION TEST COMPLETE ===");
    process.exit(0);
}

runConcurrencyTest().catch(err => {
    console.error("Test execution failed:", err);
    process.exit(1);
});
