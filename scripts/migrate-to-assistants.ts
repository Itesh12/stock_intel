import "dotenv/config";
import { MongoClient } from "mongodb";
import { v4 as uuidv4 } from "uuid";

async function runMigration() {
    const mongoUri = process.env.MONGO_URI;
    const mongoDb = process.env.MONGO_DB || "market";

    if (!mongoUri) {
        console.error("MONGO_URI is missing from environment variables.");
        process.exit(1);
    }

    console.log("=== STARTING DATABASE MIGRATION ===");
    console.log(`Connecting to MongoDB at: ${mongoUri.replace(/:[^@]+@/, ":****@")}`);
    const client = await MongoClient.connect(mongoUri);
    const db = client.db(mongoDb);

    const botsCol = db.collection("auto_trade_bots");
    const assistantsCol = db.collection("strategy_assistants");
    const portfoliosCol = db.collection("portfolios");

    // 1. Ensure strategy_assistants collection exists and creates indexes
    console.log("Setting up strategy_assistants collection indexes...");
    await assistantsCol.createIndex({ id: 1 }, { unique: true });
    await assistantsCol.createIndex({ userId: 1 });
    await assistantsCol.createIndex({ status: 1 });

    const legacyBots = await botsCol.find().toArray();
    console.log(`Found ${legacyBots.length} legacy bots in auto_trade_bots.`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const doc of legacyBots) {
        const existing = await assistantsCol.findOne({ id: doc.id });
        if (existing) {
            console.log(`[Skip] Assistant with ID ${doc.id} already exists.`);
            skippedCount++;
            continue;
        }

        // Map status
        let newStatus: string = 'PAUSED';
        if (doc.status === 'ACTIVE') {
            newStatus = 'RUNNING';
        } else if (doc.status === 'PAUSED') {
            newStatus = 'PAUSED';
        } else if (doc.status === 'STOPPED') {
            newStatus = 'COMPLETED';
        }

        const assistantDoc = {
            id: doc.id || uuidv4(),
            userId: doc.userId,
            name: doc.name,
            strategySlug: doc.strategySlug,
            strategyName: doc.strategyName,
            status: newStatus,
            mode: 'paper', // Default to paper mode
            allocatedCapital: doc.allocatedCash !== undefined ? doc.allocatedCash : (doc.capitalAllocated || 0),
            deployedCapital: doc.deployedCash || 0,
            maxPositionSizePercent: doc.maxPositionSizePercent,
            stopLossPercent: doc.stopLossPercent,
            takeProfitPercent: doc.takeProfitPercent,
            useTrailingStop: doc.useTrailingStop || false,
            minConfluenceScore: doc.minConfluenceScore,
            maxDailyLoss: doc.maxDailyLoss || 0,
            maxConcurrentPositions: doc.maxConcurrentPositions !== undefined ? doc.maxConcurrentPositions : 3,
            cooldownPeriodMinutes: doc.cooldownPeriodMinutes !== undefined ? doc.cooldownPeriodMinutes : 30,
            maxSectorAllocationPercent: doc.maxSectorAllocationPercent !== undefined ? doc.maxSectorAllocationPercent : 100,
            drawdownProtectionPercent: doc.drawdownProtectionPercent || 0,
            totalTradesExecuted: doc.totalTradesExecuted || 0,
            winCount: doc.winCount || 0,
            lossCount: doc.lossCount || 0,
            totalPnL: doc.totalPnL || 0,
            todayTradeCount: doc.todayTradeCount || 0,
            todayDate: doc.todayDate || '',
            createdAt: doc.createdAt || new Date(),
            updatedAt: doc.updatedAt || new Date()
        };

        await assistantsCol.insertOne(assistantDoc);
        console.log(`[Migrated] Bot "${doc.name}" -> Assistant "${assistantDoc.name}" (${assistantDoc.status})`);
        migratedCount++;
    }

    // 2. Align portfolio holdings reservedCash with running strategy assistants
    console.log("Aligning portfolio holding sector tags and reserved cash balances...");
    const portfolios = await portfoliosCol.find().toArray();
    for (const portfolio of portfolios) {
        // Sum up allocatedCapital of RUNNING assistants for this user
        const runningAssistants = await assistantsCol.find({ userId: portfolio.userId, status: 'RUNNING' }).toArray();
        const totalReserved = runningAssistants.reduce((sum, ass) => sum + ass.allocatedCapital, 0);

        // Update holdings botId mapping and resolve sectors where missing
        const updatedHoldings = (portfolio.holdings || []).map((holding: any) => {
            return {
                ...holding,
                botId: holding.botId || undefined,
                sector: holding.sector || 'Auto-Assigned'
            };
        });

        await portfoliosCol.updateOne(
            { id: portfolio.id },
            { $set: { reservedCash: totalReserved, holdings: updatedHoldings } }
        );
        console.log(`[Portfolio Sync] Updated portfolio for user ${portfolio.userId}. Reserved cash: ${totalReserved}`);
    }

    console.log("=== MIGRATION SCRIPTS COMPLETE ===");
    console.log(`Summary: Migrated: ${migratedCount}, Skipped: ${skippedCount}`);
    await client.close();
}

runMigration().catch(err => {
    console.error("Migration failed:", err);
    process.exit(1);
});
