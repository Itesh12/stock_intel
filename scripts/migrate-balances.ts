import { MongoClient } from "mongodb";
import { v4 as uuidv4 } from "uuid";
import * as dotenv from "dotenv";

dotenv.config();

async function migrate() {
    const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017";
    const MONGO_DB = process.env.MONGO_DB || "market";

    console.log("Connecting to MongoDB...");
    const client = await MongoClient.connect(MONGO_URI);
    const db = client.db(MONGO_DB);

    const usersCollection = db.collection("users");
    const portfoliosCollection = db.collection("portfolios");

    const users = await usersCollection.find().toArray();
    console.log(`Found ${users.length} users.`);

    let migratedCount = 0;

    for (const user of users) {
        const userId = user.id;
        const portfolio = await portfoliosCollection.findOne({ userId });

        if (!portfolio) {
            console.log(`Creating default portfolio for user: ${user.email} (${userId})`);
            await portfoliosCollection.insertOne({
                id: uuidv4(),
                userId: userId,
                name: "Default Portfolio",
                holdings: [],
                totalValue: 1000000,
                totalPL: 0,
                totalPLPercent: 0,
                cashBalance: 1000000,
                riskScore: 0,
                sectorExposure: {},
                updatedAt: new Date(),
                createdAt: new Date()
            });
            migratedCount++;
        }
    }

    console.log(`Migration complete. Created ${migratedCount} portfolios.`);
    await client.close();
}

migrate().catch(err => {
    console.error("Migration failed:", err);
    process.exit(1);
});
