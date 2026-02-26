import "dotenv/config";
import { getInfrastructure } from "../src/infrastructure/container";
import { v4 as uuidv4 } from "uuid";

async function seed() {
    const { stock: stockRepo } = await getInfrastructure();

    const stocks = [
        { id: uuidv4(), symbol: "AAPL", name: "Apple Inc.", sector: "Technology", marketCap: 2800000000000, price: 185.92, change: 1.2, changePercent: 0.65, createdAt: new Date() },
        { id: uuidv4(), symbol: "MSFT", name: "Microsoft Corp.", sector: "Technology", marketCap: 3000000000000, price: 405.12, change: -2.3, changePercent: -0.56, createdAt: new Date() },
        { id: uuidv4(), symbol: "NVDA", name: "NVIDIA Corp.", sector: "Technology", marketCap: 1700000000000, price: 726.13, change: 4.12, changePercent: 2.41, createdAt: new Date() },
        { id: uuidv4(), symbol: "TSLA", name: "Tesla, Inc.", sector: "Consumer Cyclical", marketCap: 600000000000, price: 191.23, change: -5.1, changePercent: -2.6, createdAt: new Date() },
        { id: uuidv4(), symbol: "GOOGL", name: "Alphabet Inc.", sector: "Communication Services", marketCap: 1800000000000, price: 145.23, change: 0.45, changePercent: 0.31, createdAt: new Date() },
    ];

    console.log("Seeding real stocks...");
    for (const stock of stocks) {
        await stockRepo.save(stock as any);
        console.log(`Saved ${stock.symbol}`);
    }
    console.log("Seeding complete!");
    process.exit(0);
}

seed().catch(console.error);
