import { getInfrastructure } from "../src/infrastructure/container";
import { strategies as staticStrategies } from "../src/data/strategies";
import { v4 as uuidv4 } from "uuid";
import * as dotenv from "dotenv";

dotenv.config();

async function seed() {
    console.log("Seeding strategies...");
    const infra = await getInfrastructure();

    for (const s of staticStrategies) {
        const strategy = {
            ...s,
            slug: (s as any).slug || s.id,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        await infra.strategy.save(strategy as any);
        console.log(`Seeded strategy: ${strategy.name} (Slug: ${strategy.slug})`);
    }

    process.exit(0);
}

seed().catch(err => {
    console.error(err);
    process.exit(1);
});
