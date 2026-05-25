import "dotenv/config";

try {
  const Module = require('module');
  const mockPath = require.resolve('server-only');
  Module._cache[mockPath] = {
    id: mockPath,
    filename: mockPath,
    exports: {},
    loaded: true
  };
} catch (e) {
  // Ignore
}

import { MongoClient } from "mongodb";

// Mock MongoClient.connect globally to avoid dependency on a running database server
(MongoClient as any).connect = async () => {
    const mockCollection = {
        createIndex: async () => {},
        findOne: async () => null,
        find: () => ({
            toArray: async () => []
        }),
        updateOne: async () => ({ matchedCount: 1 }),
        insertOne: async () => {},
        deleteOne: async () => {},
        deleteMany: async () => {}
    };

    const mockDb = {
        collection: (name: string) => mockCollection
    };

    return {
        db: () => mockDb,
        close: async () => {}
    } as any;
};

import { getInfrastructure } from "../src/infrastructure/container";

async function testWorkers() {
    console.log("=== STARTING WORKERS INITIALIZATION TEST ===");
    console.log("Invoking getInfrastructure()...");
    await getInfrastructure();
    console.log("Infrastructure loaded. Waiting 10 seconds to observe boot delay and startup logs...");
    await new Promise(resolve => setTimeout(resolve, 10000));
    console.log("=== WORKERS TEST COMPLETE ===");
    process.exit(0);
}

testWorkers().catch(err => {
    console.error("Test error:", err);
    process.exit(1);
});
