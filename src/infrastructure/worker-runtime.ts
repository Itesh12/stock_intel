import { getInfrastructure } from "./container";

async function main() {
    console.log("[WorkerRuntime] Starting dedicated worker process...");
    try {
        const infra = await getInfrastructure();
        
        console.log("[WorkerRuntime] Running WorkerManager startAll...");
        infra.workerManager.startAll();

        // Graceful shutdown handling
        const shutdown = () => {
            console.log("[WorkerRuntime] Termination signal received. Stopping workers...");
            infra.workerManager.stopAll(async () => {
                console.log("[WorkerRuntime] All worker loops stopped. Closing MongoDB connection...");
                if (infra.mongoClient) {
                    try {
                        await infra.mongoClient.close();
                        console.log("[WorkerRuntime] MongoDB connection closed successfully.");
                    } catch (closeErr) {
                        console.error("[WorkerRuntime] Error closing MongoDB connection:", closeErr);
                    }
                }
                console.log("[WorkerRuntime] Exit.");
                process.exit(0);
            });
        };

        process.on("SIGINT", shutdown);
        process.on("SIGTERM", shutdown);
    } catch (err) {
        console.error("[WorkerRuntime] Critical initialization error:", err);
        process.exit(1);
    }
}

main();
